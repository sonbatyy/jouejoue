const express = require("express");
const db = require("../db");
const { generatePersonalizedToken } = require("../lib/tokens");
const { computeExpiry } = require("../lib/expiry");
const { resolveCurrency, withLocalizedPrice, allLocalizedPrices, localizedPrice, SWITCHABLE_CURRENCIES } = require("../lib/pricing");
const { sendPurchaseReceipt, sendGameInvite } = require("../lib/email");
const { recordReceipt } = require("../lib/receipts");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/payment/:templateId", async (req, res) => {
  const template = db
    .prepare("SELECT * FROM game_templates WHERE id = ? AND is_custom_tier = 0")
    .get(req.params.templateId);
  if (!template) return res.status(404).render("expired", { message: "That game doesn't exist." });
  const currency = await resolveCurrency(req);
  // The curated switcher list plus whatever we actually detected for this
  // visitor, in case geolocation landed on a currency outside that curated
  // set (e.g. TRY) — their own detected price should always be an option,
  // not silently swapped for the first entry in the list.
  const currencies = currency && !SWITCHABLE_CURRENCIES.includes(currency)
    ? [currency, ...SWITCHABLE_CURRENCIES]
    : SWITCHABLE_CURRENCIES;
  res.render("payment", {
    template: withLocalizedPrice(template, currency),
    currency,
    allPrices: { ...allLocalizedPrices(template), [currency]: localizedPrice(template, currency) },
    currencies,
  });
});

// Mock checkout only: intentionally never reads req.body here, so no card
// field the visitor typed is ever stored, logged, or forwarded anywhere.
// A real Stripe/PayPal integration would replace this whole handler later,
// once there's a real merchant account behind it.
router.post("/payment/:templateId", (req, res) => {
  res.redirect(`/buy/${req.params.templateId}`);
});

router.get("/buy/:templateId", async (req, res) => {
  const template = db
    .prepare("SELECT * FROM game_templates WHERE id = ? AND is_custom_tier = 0")
    .get(req.params.templateId);
  if (!template) return res.status(404).render("expired", { message: "That game doesn't exist." });
  const currency = await resolveCurrency(req);
  res.render("buy", { template: withLocalizedPrice(template, currency) });
});

router.post("/api/instances", async (req, res) => {
  const templateId = Number(req.body.templateId);
  const buyerEmail = String(req.body.buyerEmail || "").trim();
  const recipientName = String(req.body.recipientName || "").trim();
  const question = String(req.body.question || "").trim();
  const senderName = String(req.body.senderName || "").trim();
  const note = String(req.body.note || "").trim();
  const deliveryMethod = req.body.deliveryMethod === "email" ? "email" : "link";
  const recipientEmail = String(req.body.recipientEmail || "").trim();

  const template = db
    .prepare("SELECT * FROM game_templates WHERE id = ? AND is_custom_tier = 0")
    .get(templateId);
  if (!template) return res.status(400).send("Unknown game.");
  if (!recipientName) return res.status(400).send("Please enter their name.");
  if (!EMAIL_RE.test(buyerEmail)) return res.status(400).send("Please enter a valid email.");
  if (!question) return res.status(400).send("Please write a question.");
  if (!senderName) return res.status(400).send("Please enter your name.");
  if (deliveryMethod === "email" && !EMAIL_RE.test(recipientEmail)) {
    return res.status(400).send("Please enter a valid email for the recipient.");
  }

  // A link that reads as "made for Juju" instead of a random string —
  // the isTaken check keeps it safe if the same name buys twice.
  const isTaken = (candidate) =>
    !!db.prepare("SELECT 1 FROM game_instances WHERE token = ?").get(candidate);
  const token = generatePersonalizedToken(recipientName, isTaken);
  const now = Date.now();
  db.prepare(`
    INSERT INTO game_instances (template_id, token, buyer_email, recipient_name, question, status, created_at, expires_at, sender_name, note, delivery_method, recipient_email)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
  `).run(
    template.id,
    token,
    buyerEmail,
    recipientName,
    question,
    now,
    computeExpiry(now),
    senderName,
    note,
    deliveryMethod,
    deliveryMethod === "email" ? recipientEmail : null
  );

  const shareUrl = `${req.protocol}://${req.get("host")}/play/${token}`;
  const currency = await resolveCurrency(req);
  const priceDisplay = localizedPrice(template, currency);
  const { receiptNumber, createdAt } = recordReceipt({
    kind: "purchase",
    buyerEmail,
    buyerName: senderName,
    itemName: template.name,
    itemDetail: `For ${recipientName}`,
    amountDisplay: priceDisplay,
    currency,
    relatedToken: token,
  });
  sendPurchaseReceipt({
    buyerEmail,
    templateName: template.name,
    recipientName,
    priceDisplay,
    shareUrl,
    receiptNumber,
    date: new Date(createdAt).toLocaleDateString(),
  });

  if (deliveryMethod === "email") {
    sendGameInvite({
      recipientEmail,
      recipientName,
      senderName,
      note,
      templateName: template.name,
      shareUrl,
    });
  }

  res.redirect(`/confirmation/${token}`);
});

router.get("/confirmation/:token", async (req, res) => {
  const instance = db.prepare("SELECT * FROM game_instances WHERE token = ?").get(req.params.token);
  if (!instance) return res.status(404).render("expired", { message: "That link doesn't exist." });
  const template = db.prepare("SELECT * FROM game_templates WHERE id = ?").get(instance.template_id);
  const shareUrl = `${req.protocol}://${req.get("host")}/play/${instance.token}`;
  const currency = await resolveCurrency(req);
  res.render("confirmation", { instance, template: withLocalizedPrice(template, currency), shareUrl });
});

module.exports = router;
