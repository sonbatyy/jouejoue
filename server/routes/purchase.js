const express = require("express");
const db = require("../db");
const { generateToken } = require("../lib/tokens");
const { computeExpiry } = require("../lib/expiry");
const { resolveCurrency, withLocalizedPrice } = require("../lib/pricing");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/payment/:templateId", async (req, res) => {
  const template = db
    .prepare("SELECT * FROM game_templates WHERE id = ? AND is_custom_tier = 0")
    .get(req.params.templateId);
  if (!template) return res.status(404).render("expired", { message: "That game doesn't exist." });
  const currency = await resolveCurrency(req);
  res.render("payment", { template: withLocalizedPrice(template, currency) });
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

router.post("/api/instances", (req, res) => {
  const templateId = Number(req.body.templateId);
  const buyerEmail = String(req.body.buyerEmail || "").trim();
  const question = String(req.body.question || "").trim();

  const template = db
    .prepare("SELECT * FROM game_templates WHERE id = ? AND is_custom_tier = 0")
    .get(templateId);
  if (!template) return res.status(400).send("Unknown game.");
  if (!EMAIL_RE.test(buyerEmail)) return res.status(400).send("Please enter a valid email.");
  if (!question) return res.status(400).send("Please write a question.");

  const token = generateToken();
  const now = Date.now();
  db.prepare(`
    INSERT INTO game_instances (template_id, token, buyer_email, question, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `).run(template.id, token, buyerEmail, question, now, computeExpiry(now));

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
