const crypto = require("crypto");

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Same {price_egp, price_usd_cents} shape as RENEWAL_PRICE (server/lib/
// expiry.js) so localizedPrice() from pricing.js works on these unchanged.
const SUBSCRIPTION_TIERS = {
  random: {
    key: "random",
    name: "Surprise Subscription",
    price_egp: 300,
    price_usd_cents: 500,
    description: "A random game from the bank, sent to them every month.",
  },
  personalized: {
    key: "personalized",
    name: "Personalized Subscription",
    price_egp: 600,
    price_usd_cents: 1000,
    description: "A game built around your idea, every month.",
  },
};

function getTier(tierKey) {
  return SUBSCRIPTION_TIERS[tierKey] || null;
}

// Opaque, not personalized like a game link's token — this URL doubles as
// the only "login" a subscriber has to their own subscription (no account
// system exists), so it needs to be unguessable, not readable.
function generateManageToken() {
  return crypto.randomBytes(20).toString("base64url");
}

// Delivery is pulled, not pushed: this just answers "has a real month
// passed since the last one" — no cron, no background job, nothing
// auto-charges. Matches the honesty of every other mock-checkout flow here.
function isDeliveryDue(subscription, now = Date.now()) {
  return now >= subscription.last_delivered_at + ONE_MONTH_MS;
}

function nextDeliveryAt(subscription) {
  return subscription.last_delivered_at + ONE_MONTH_MS;
}

module.exports = { SUBSCRIPTION_TIERS, ONE_MONTH_MS, getTier, generateManageToken, isDeliveryDue, nextDeliveryAt };
