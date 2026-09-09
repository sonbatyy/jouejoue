const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Flat monthly renewal fee — separate from whatever the original game cost,
// and the same regardless of which game it was ("Renewable monthly for a
// small fee" on the pricing page).
const RENEWAL_PRICE = { price_egp: 50, price_usd_cents: 100 };

function computeExpiry(fromMs) {
  return fromMs + ONE_MONTH_MS;
}

function isExpired(instance, now = Date.now()) {
  return now > instance.expires_at;
}

module.exports = { ONE_MONTH_MS, RENEWAL_PRICE, computeExpiry, isExpired };
