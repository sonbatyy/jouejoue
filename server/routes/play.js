const express = require("express");
const db = require("../db");
const { isExpired, computeExpiry } = require("../lib/expiry");
const { sendAnswerNotification } = require("../lib/email");
const { resolveCurrency, localizedPrice } = require("../lib/pricing");

const router = express.Router();

function loadInstance(token) {
  const instance = db.prepare("SELECT * FROM game_instances WHERE token = ?").get(token);
  if (!instance) return null;
  const template = db.prepare("SELECT * FROM game_templates WHERE id = ?").get(instance.template_id);
  return { instance, template };
}

router.get("/play/:token", async (req, res) => {
  const found = loadInstance(req.params.token);
  if (!found) return res.status(404).render("expired", { message: "That link doesn't exist." });
  const { instance, template } = found;

  if (instance.status === "answered") {
    return res.render("already-answered", { instance, template });
  }
  if (isExpired(instance)) {
    const currency = await resolveCurrency(req);
    return res.render("expired", {
      message: `This game expired on ${new Date(instance.expires_at).toLocaleDateString()}.`,
      token: instance.token,
      canRenew: true,
      renewPriceDisplay: localizedPrice({ price_egp: 50, price_usd_cents: 100 }, currency),
    });
  }

  res.render("play", {
    template,
    playData: {
      token: instance.token,
      templateSlug: template.slug,
      question: instance.question,
    },
  });
});

router.post("/api/play/:token/answer", (req, res) => {
  const found = loadInstance(req.params.token);
  if (!found) return res.status(404).json({ error: "Not found" });
  const { instance, template } = found;

  if (instance.status === "answered") return res.status(409).json({ error: "Already answered" });
  if (isExpired(instance)) return res.status(410).json({ error: "Expired" });

  const answer = String(req.body.answer || "").trim();
  if (!answer) return res.status(400).json({ error: "Answer is required" });

  const now = Date.now();
  db.prepare("UPDATE game_instances SET answer = ?, answered_at = ?, status = 'answered' WHERE id = ?").run(
    answer,
    now,
    instance.id
  );

  sendAnswerNotification({
    buyerEmail: instance.buyer_email,
    templateName: template.name,
    question: instance.question,
    answer,
    instanceToken: instance.token,
  });

  res.json({ ok: true });
});

router.post("/api/instances/:token/renew", (req, res) => {
  const found = loadInstance(req.params.token);
  if (!found) return res.status(404).json({ error: "Not found" });
  const { instance } = found;

  const base = Math.max(instance.expires_at, Date.now());
  const newExpiry = computeExpiry(base);
  db.prepare("UPDATE game_instances SET expires_at = ?, renewed_count = renewed_count + 1 WHERE id = ?").run(
    newExpiry,
    instance.id
  );

  res.json({ ok: true, expiresAt: newExpiry });
});

module.exports = router;
