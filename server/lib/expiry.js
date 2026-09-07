const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function computeExpiry(fromMs) {
  return fromMs + ONE_MONTH_MS;
}

function isExpired(instance, now = Date.now()) {
  return now > instance.expires_at;
}

module.exports = { ONE_MONTH_MS, computeExpiry, isExpired };
