const { parseCookies } = require("../lib/cookies");
const { isValidToken } = require("../lib/accessToken");

const COOKIE_NAME = "joue_access";

// Paths that must stay reachable without the password, or the gate page
// itself couldn't load (its own CSS/JS) and there'd be no way in at all.
const EXEMPT_PREFIXES = ["/access", "/css/", "/js/"];

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
