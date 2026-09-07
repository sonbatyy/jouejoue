const { lookupCountryCode } = require("./geo");

// Approximate rates relative to 1 USD. Static and occasionally stale by
// design: prices are mocked (no real payment happens), so this is for
// display only, not a live-rate feed requiring its own API/account later.
const USD_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  SAR: 3.75,
  CAD: 1.36,
  AUD: 1.52,
  INR: 83.5,
  JPY: 149,
  CNY: 7.24,
  TRY: 32.5,
  KWD: 0.31,
  QAR: 3.64,
  ZAR: 18.6,
  NGN: 1550,
  MAD: 9.9,
};

// Country/region code (from a locale tag's region subtag) -> currency code.
// Falls back to USD for anything not listed here.
const REGION_TO_CURRENCY = {
  EG: "EGP",
  US: "USD",
  GB: "GBP",
  IE: "EUR",
  FR: "EUR",
  DE: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  PT: "EUR",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  CA: "CAD",
  AU: "AUD",
  IN: "INR",
  JP: "JPY",
  CN: "CNY",
  TR: "TRY",
  ZA: "ZAR",
  NG: "NGN",
  MA: "MAD",
};

function currencyForCountry(countryCode) {
  return (countryCode && REGION_TO_CURRENCY[countryCode.toUpperCase()]) || null;
}

/**
 * Fallback only: picks a currency from the browser's Accept-Language header
 * (the region subtag of its first locale, e.g. "fr-FR" -> "FR" -> EUR).
 * This is a language preference, not a location — someone in Egypt running
 * their browser in English (UK) would read as GB here. Real geolocation
 * (server/lib/geo.js, IP-based) is tried first; this only kicks in if that
 * lookup fails (offline, rate-limited, etc).
 */
function detectCurrencyFromAcceptLanguage(acceptLanguageHeader) {
  if (!acceptLanguageHeader) return "USD";
  const firstTag = acceptLanguageHeader.split(",")[0].trim().split(";")[0];
  const region = firstTag.split("-")[1];
  return currencyForCountry(region) || "USD";
}

function formatEgp(egp) {
  return `${egp} EGP`;
}

function formatConverted(usdCents, currency) {
  const amount = (usdCents / 100) * (USD_RATES[currency] || 1);
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: amount >= 20 ? 0 : 2,
    }).format(amount);
  } catch (err) {
    // Unknown/unsupported currency code: fall back to a plain USD price.
    return `$${(usdCents / 100).toFixed(2)}`;
  }
}

/**
 * The one price string to show a visitor: their local EGP price if they're
 * in Egypt (a deliberately set price, not a conversion), otherwise their
 * home currency converted from the USD base price.
 */
function localizedPrice(template, currency) {
  if (currency === "EGP") return formatEgp(template.price_egp);
  return formatConverted(template.price_usd_cents, currency);
}

function withLocalizedPrice(template, currency) {
  return { ...template, priceDisplay: localizedPrice(template, currency) };
}

/**
 * Real geolocation first (where the connection is actually from), the
 * language-header guess only if that lookup fails for any reason.
 */
async function resolveCurrency(req) {
  const countryCode = await lookupCountryCode(req.ip);
  return currencyForCountry(countryCode) || detectCurrencyFromAcceptLanguage(req.headers["accept-language"]);
}

module.exports = {
  currencyForCountry,
  detectCurrencyFromAcceptLanguage,
  resolveCurrency,
  localizedPrice,
  withLocalizedPrice,
  formatConverted,
  formatEgp,
};
