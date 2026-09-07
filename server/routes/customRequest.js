const express = require("express");
const db = require("../db");
const { resolveCurrency, withLocalizedPrice } = require("../lib/pricing");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/custom-request/:templateId", async (req, res) => {
  const template = db
    .prepare("SELECT * FROM game_templates WHERE id = ? AND is_custom_tier = 1")
    .get(req.params.templateId);
  if (!template) return res.status(404).render("expired", { message: "That option doesn't exist." });
  const currency = await resolveCurrency(req);
  res.render("custom-request", { template: withLocalizedPrice(template, currency) });
});

router.post("/api/custom-requests", (req, res) => {
  const buyerEmail = String(req.body.buyerEmail || "").trim();
  const gameIdea = String(req.body.gameIdea || "").trim();
  const purpose = String(req.body.purpose || "").trim();

  if (!EMAIL_RE.test(buyerEmail)) return res.status(400).send("Please enter a valid email.");
  if (!gameIdea) return res.status(400).send("Please describe what you want the game to be.");
  if (!purpose) return res.status(400).send("Please describe what it's for.");

  db.prepare(
    "INSERT INTO custom_game_requests (buyer_email, game_idea, purpose, created_at) VALUES (?, ?, ?, ?)"
  ).run(buyerEmail, gameIdea, purpose, Date.now());

  res.render("custom-request-thanks", { buyerEmail });
});

module.exports = router;
