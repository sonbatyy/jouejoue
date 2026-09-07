// Real IP-based geolocation, not a language-preference guess: a visitor's
// Accept-Language header reflects their browser's language setting (e.g.
// "English (UK)"), not where they actually are — someone in Egypt with an
// en-GB browser would get shown GBP under that approach. This looks up the
// country their connection is actually coming from instead.
//
// Uses ip-api.com's free JSON endpoint (no signup, no API key, generous
// rate limit for a prototype). Results are cached briefly per IP so page
// loads don't re-hit it every time, and any failure (timeout, offline,
// rate-limited) just falls through to the caller's own fallback rather
// than breaking the page.

const geoCache = new Map(); // ip -> { countryCode, expiresAt }
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const LOOKUP_TIMEOUT_MS = 2000;

const PRIVATE_IP_RE = /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.)/;

function isPrivateIp(ip) {
  return !ip || PRIVATE_IP_RE.test(ip);
}

/**
 * Resolves a country code for the given client IP. When the IP is a local/
 * private address (always true when this is running on localhost, since
 * there's no real visitor IP to look up), it asks ip-api.com for the
 * server's own public egress IP instead — meaningful when you're testing
 * from the same network you're developing on, meaningless once this is
 * deployed somewhere else and fielding real visitor IPs (which will then
 * flow through correctly instead).
 */
async function lookupCountryCode(ip) {
  const cacheKey = isPrivateIp(ip) ? "__self__" : ip;
  const cached = geoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.countryCode;

  const url = isPrivateIp(ip)
    ? "http://ip-api.com/json/?fields=countryCode"
    : `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=countryCode`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const countryCode = data.countryCode || null;
    geoCache.set(cacheKey, { countryCode, expiresAt: Date.now() + CACHE_TTL_MS });
    return countryCode;
  } catch (err) {
    return null;
  }
}

module.exports = { lookupCountryCode };
