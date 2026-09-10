const express = require("express");
const db = require("../db");
const { isExpired, computeExpiry, RENEWAL_PRICE } = require("../lib/expiry");
const { sendAnswerNotification, sendRenewalReceipt } = require("../lib/email");
const { resolveCurrency, localizedPrice } = require("../lib/pricing");

const router = express.Router();

function loadInstance(token) {
  const instance = db.prepare("SELECT * FROM game_instances WHERE token = ?").get(token);
  if (!instance) return null;
  const template = db.prepare("SELECT * FROM game_templates WHERE id = ?").get(instance.template_id);
  return { instance, template };
}

// Shared by the mock-checkout page (POST /renew/:token) and the JSON API
// (POST /api/instances/:token/renew) — one place that actually extends the
// expiry, so the two entry points can't drift on what "renewing" means.
function renewInstance(instance) {
  const base = Math.max(instance.expires_at, Date.now());
  const newExpiry = computeExpiry(base);
  db.prepare("UPDATE game_instances SET expires_at = ?, renewed_count = renewed_count + 1 WHERE id = ?").run(
    newExpiry,
    instance.id
  );
  return newExpiry;
}

router.get("/play/:token", async (req, res) => {
  const found = loadInstance(req.params.token);
  if (!found) return res.status(404).render("expired", { message: "That link doesn't exist." });
  const { instance, template } = found;

  if (instance.status === "answered") {
    return res.render("already-answered", { instance, template });
  }
  if (isExpired(instance)) {
    return res.render("expired", {
      message: `This game expired on ${new Date(instance.expires_at).toLocaleDateString()}.`,
      token: instance.token,
      canRenew: true,
    });
  }

  res.render("play", {
    template,
    playData: {
      token: instance.token,
      templateSlug: template.slug,
      question: instance.question,
      recipientName: instance.recipient_name,
      senderName: instance.sender_name || "",
      note: instance.note || "",
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
    recipientName: instance.recipient_name,
    question: instance.question,
    answer,
    instanceToken: instance.token,
  });

  res.json({ ok: true });
});

router.post("/api/instances/:token/renew", (req, res) => {
  const found = loadInstance(req.params.token);
  if (!found) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true, expiresAt: renewInstance(found.instance) });
});

// A real mock-checkout page (card fields, same look as buying a game)
// instead of a bare "simulate renewal" button — reads the same as the
// rest of the site's purchase flow.
router.get("/renew/:token", async (req, res) => {
  const found = loadInstance(req.params.token);
  if (!found) return res.status(404).render("expired", { message: "That link doesn't exist." });
  const { instance, template } = found;
  const currency = await resolveCurrency(req);
  res.render("renew", {
    instance,
    template,
    priceDisplay: localizedPrice(RENEWAL_PRICE, currency),
  });
});

// Mock checkout only, same as /payment/:templateId: never reads the card
// fields from req.body, just performs the actual renewal.
router.post("/renew/:token", async (req, res) => {
  const found = loadInstance(req.params.token);
  if (!found) return res.status(404).render("expired", { message: "That link doesn't exist." });
  const { instance, template } = found;
  const newExpiry = renewInstance(instance);

  const currency = await resolveCurrency(req);
  sendRenewalReceipt({
    buyerEmail: instance.buyer_email,
    templateName: template.name,
    recipientName: instance.recipient_name,
    priceDisplay: localizedPrice(RENEWAL_PRICE, currency),
    newExpiryDate: new Date(newExpiry).toLocaleDateString(),
    shareUrl: `${req.protocol}://${req.get("host")}/play/${instance.token}`,
  });

  res.redirect(`/play/${instance.token}`);
});

module.exports = router;
