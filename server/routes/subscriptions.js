const express = require("express");
const db = require("../db");
const { generatePersonalizedToken } = require("../lib/tokens");
const { computeExpiry } = require("../lib/expiry");
const { resolveCurrency, withLocalizedPrice, localizedPrice } = require("../lib/pricing");
const { SUBSCRIPTION_TIERS, getTier, generateManageToken, isDeliveryDue, nextDeliveryAt } = require("../lib/subscriptions");
const { sendSubscriptionReceipt, sendGameInvite } = require("../lib/email");
const { recordReceipt } = require("../lib/receipts");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function loadSubscription(manageToken) {
  return db.prepare("SELECT * FROM subscriptions WHERE manage_token = ?").get(manageToken);
}

function manageUrl(req, manageToken) {
  return `${req.protocol}://${req.get("host")}/subscription/${manageToken}`;
}

// Picks a template every random-tier delivery gets — any bank game, never
// the custom tier itself (that's a different, non-instant flow).
function pickRandomTemplate() {
  const rows = db.prepare("SELECT * FROM game_templates WHERE is_custom_tier = 0").all();
  return rows[Math.floor(Math.random() * rows.length)];
}

// One cycle's delivery for an already-existing subscription — shared by the
// signup route (month 1, delivered immediately) and the manage page's "get
// this month's game" button (every month after). Updates the subscription
// row, records a receipt, and sends whichever emails that tier calls for.
async function deliverCycle(req, subscription) {
  const monthLabel = `Month ${subscription.deliveries_count + 1}`;
  const currency = await resolveCurrency(req);
  const tier = getTier(subscription.tier);
  const priceDisplay = localizedPrice(tier, currency);
  let detail;

  if (subscription.tier === "random") {
    const template = pickRandomTemplate();
    const isTaken = (candidate) => !!db.prepare("SELECT 1 FROM game_instances WHERE token = ?").get(candidate);
    const token = generatePersonalizedToken(subscription.recipient_name, isTaken);
    const now = Date.now();
    db.prepare(`
      INSERT INTO game_instances (template_id, token, buyer_email, recipient_name, question, status, created_at, expires_at, sender_name, note, delivery_method, recipient_email, level)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 'email', ?, 'medium')
    `).run(
      template.id,
      token,
      subscription.subscriber_email,
      subscription.recipient_name,
      subscription.question,
      now,
      computeExpiry(now),
      subscription.subscriber_name,
      "",
      subscription.recipient_email
    );
    const shareUrl = `${req.protocol}://${req.get("host")}/play/${token}`;
    sendGameInvite({
      recipientEmail: subscription.recipient_email,
      recipientName: subscription.recipient_name,
      senderName: subscription.subscriber_name,
      note: "",
      templateName: template.name,
      shareUrl,
    });
    detail = `Sent to ${subscription.recipient_name}: ${template.name}`;
  } else {
    db.prepare(
      "INSERT INTO custom_game_requests (buyer_email, game_idea, purpose, created_at) VALUES (?, ?, ?, ?)"
    ).run(subscription.subscriber_email, subscription.game_idea, `Monthly subscription — for ${subscription.recipient_name}`, Date.now());
    detail = "We're building this month's custom idea";
  }

  const { receiptNumber, createdAt } = recordReceipt({
    kind: "subscription",
    buyerEmail: subscription.subscriber_email,
    buyerName: subscription.subscriber_name,
    itemName: tier.name,
    itemDetail: detail,
    amountDisplay: priceDisplay,
    currency,
  });

  sendSubscriptionReceipt({
    subscriberEmail: subscription.subscriber_email,
    tierName: tier.name,
    monthLabel,
    priceDisplay,
    detail,
    manageUrl: manageUrl(req, subscription.manage_token),
    receiptNumber,
    date: new Date(createdAt).toLocaleDateString(),
  });

  db.prepare(
    "UPDATE subscriptions SET last_delivered_at = ?, deliveries_count = deliveries_count + 1 WHERE id = ?"
  ).run(Date.now(), subscription.id);
}

router.get("/subscribe", async (req, res) => {
  const currency = await resolveCurrency(req);
  res.render("subscribe", {
    tiers: Object.values(SUBSCRIPTION_TIERS).map((t) => withLocalizedPrice(t, currency)),
  });
});

router.get("/subscribe-payment/:tier", async (req, res) => {
  const tier = getTier(req.params.tier);
  if (!tier) return res.status(404).render("expired", { message: "That plan doesn't exist." });
  const currency = await resolveCurrency(req);
  res.render("subscribe-payment", { tier: withLocalizedPrice(tier, currency) });
});

// Mock checkout only, same as every other checkout in this app: never
// reads card fields from req.body.
router.post("/subscribe-payment/:tier", (req, res) => {
  res.redirect(`/subscribe-setup/${req.params.tier}`);
});

router.get("/subscribe-setup/:tier", async (req, res) => {
  const tier = getTier(req.params.tier);
  if (!tier) return res.status(404).render("expired", { message: "That plan doesn't exist." });
  const currency = await resolveCurrency(req);
  res.render("subscribe-setup", { tier: withLocalizedPrice(tier, currency) });
});

router.post("/api/subscriptions", async (req, res) => {
  const tierKey = req.body.tier;
  const tier = getTier(tierKey);
  const subscriberName = String(req.body.subscriberName || "").trim();
  const subscriberEmail = String(req.body.subscriberEmail || "").trim();
  const recipientName = String(req.body.recipientName || "").trim();
  const recipientEmail = String(req.body.recipientEmail || "").trim();
  const question = String(req.body.question || "").trim();
  const gameIdea = String(req.body.gameIdea || "").trim();

  if (!tier) return res.status(400).send("Unknown plan.");
  if (!subscriberName) return res.status(400).send("Please enter your name.");
  if (!EMAIL_RE.test(subscriberEmail)) return res.status(400).send("Please enter a valid email.");
  if (!recipientName) return res.status(400).send("Please enter their name.");
  if (!EMAIL_RE.test(recipientEmail)) return res.status(400).send("Please enter a valid email for the recipient.");
  if (tierKey === "random" && !question) return res.status(400).send("Please write a question.");
  if (tierKey === "personalized" && !gameIdea) return res.status(400).send("Please describe the kind of game you want each month.");

  const manageToken = generateManageToken();
  const now = Date.now();
  db.prepare(`
    INSERT INTO subscriptions (manage_token, tier, subscriber_name, subscriber_email, recipient_name, recipient_email, question, game_idea, status, started_at, last_delivered_at, deliveries_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 0)
  `).run(manageToken, tierKey, subscriberName, subscriberEmail, recipientName, recipientEmail, question, gameIdea, now, now - 1); // last_delivered_at set one ms in the past so month 1 delivers immediately below, not on the next visit

  const subscription = loadSubscription(manageToken);
  await deliverCycle(req, subscription);

  res.redirect(`/subscription/${manageToken}`);
});

router.get("/subscription/:manageToken", async (req, res) => {
  const subscription = loadSubscription(req.params.manageToken);
  if (!subscription) return res.status(404).render("expired", { message: "That subscription doesn't exist." });
  const currency = await resolveCurrency(req);
  const tier = withLocalizedPrice(getTier(subscription.tier), currency);
  res.render("subscription-manage", {
    subscription,
    tier,
    due: subscription.status === "active" && isDeliveryDue(subscription),
    nextDeliveryDate: new Date(nextDeliveryAt(subscription)).toLocaleDateString(),
  });
});

router.post("/subscription/:manageToken/deliver", async (req, res) => {
  const subscription = loadSubscription(req.params.manageToken);
  if (!subscription) return res.status(404).render("expired", { message: "That subscription doesn't exist." });
  if (subscription.status === "active" && isDeliveryDue(subscription)) {
    await deliverCycle(req, subscription);
  }
  res.redirect(`/subscription/${subscription.manage_token}`);
});

router.post("/subscription/:manageToken/cancel", (req, res) => {
  const subscription = loadSubscription(req.params.manageToken);
  if (!subscription) return res.status(404).render("expired", { message: "That subscription doesn't exist." });
  db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE id = ?").run(subscription.id);
  res.redirect(`/subscription/${subscription.manage_token}`);
});

module.exports = router;
