const { parseCookies } = require("../lib/cookies");
const { isValidToken } = require("../lib/accessToken");

const COOKIE_NAME = "joue_access";

// Paths that must stay reachable without the password. /access, /css/, /js/
// so the gate page itself can load (its own CSS/JS) — without them there'd
// be no way in at all. /images/ for a different reason: emails (the logo in
// every branded email) and link-preview crawlers fetch images with no
// session cookie at all, so without this exemption every image request from
// outside a logged-in browser 302-redirects to the password page instead of
// returning the image — which is exactly why the logo wasn't loading in
// received emails. Images alone reveal nothing about the app itself, so
// exempting them doesn't weaken the gate's actual purpose.
const EXEMPT_PREFIXES = ["/access", "/css/", "/js/", "/images/"];

function isExempt(path) {
  return EXEMPT_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

/**
 * Temporary gate: not real auth, no per-user identity, just a shared
 * password so this prototype isn't sitting wide open on a guessable/shared
 * link before real payments exist. Swap for something real once it does.
 */
function accessGate(req, res, next) {
  if (isExempt(req.path)) return next();

  const cookies = parseCookies(req);
  if (isValidToken(cookies[COOKIE_NAME])) return next();

  const redirectTo = encodeURIComponent(req.originalUrl);
  res.redirect(`/access?redirect=${redirectTo}`);
}

module.exports = { accessGate, COOKIE_NAME };
