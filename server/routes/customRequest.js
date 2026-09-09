const express = require("express");
const db = require("../db");
const { resolveCurrency, withLocalizedPrice, localizedPrice } = require("../lib/pricing");
const { sendCustomRequestReceipt } = require("../lib/email");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function loadCustomTemplate(templateId) {
  return db.prepare("SELECT * FROM game_templates WHERE id = ? AND is_custom_tier = 1").get(templateId);
}

// Mock checkout, same pattern as /payment/:templateId — a card-entry step
// before the idea/purpose/email form, so the "Custom Game" tier's price
// on the pricing page actually means something instead of skipping
// straight to a free-form request.
router.get("/custom-payment/:templateId", async (req, res) => {
  const template = loadCustomTemplate(req.params.templateId);
  if (!template) return res.status(404).render("expired", { message: "That option doesn't exist." });
  const currency = await resolveCurrency(req);
  res.render("custom-payment", { template: withLocalizedPrice(template, currency) });
});

// Mock checkout only: intentionally never reads req.body here, same as
// POST /payment/:templateId — no card field the visitor typed is ever
// stored, logged, or forwarded anywhere.
router.post("/custom-payment/:templateId", (req, res) => {
  res.redirect(`/custom-request/${req.params.templateId}`);
});

router.get("/custom-request/:templateId", async (req, res) => {
  const template = loadCustomTemplate(req.params.templateId);
  if (!template) return res.status(404).render("expired", { message: "That option doesn't exist." });
  const currency = await resolveCurrency(req);
  res.render("custom-request", { template: withLocalizedPrice(template, currency) });
});

router.post("/api/custom-requests", async (req, res) => {
  const templateId = Number(req.body.templateId);
  const buyerEmail = String(req.body.buyerEmail || "").trim();
  const gameIdea = String(req.body.gameIdea || "").trim();
  const purpose = String(req.body.purpose || "").trim();

  const template = loadCustomTemplate(templateId);
  if (!template) return res.status(400).send("Unknown option.");
  if (!EMAIL_RE.test(buyerEmail)) return res.status(400).send("Please enter a valid email.");
  if (!gameIdea) return res.status(400).send("Please describe what you want the game to be.");
  if (!purpose) return res.status(400).send("Please describe what it's for.");

  db.prepare(
    "INSERT INTO custom_game_requests (template_id, buyer_email, game_idea, purpose, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(template.id, buyerEmail, gameIdea, purpose, Date.now());

  const currency = await resolveCurrency(req);
  sendCustomRequestReceipt({
    buyerEmail,
    templateName: template.name,
    priceDisplay: localizedPrice(template, currency),
    gameIdea,
    purpose,
  });

  res.render("custom-request-thanks", { buyerEmail });
});

module.exports = router;
