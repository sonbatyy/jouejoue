const express = require("express");
const db = require("../db");

const router = express.Router();

// Dev-only: lets us demonstrate expiry without waiting 30 days.
// Not linked from any page; not mounted when NODE_ENV=production.
router.post("/api/debug/instances/:token/set-expiry", (req, res) => {
  const instance = db.prepare("SELECT * FROM game_instances WHERE token = ?").get(req.params.token);
  if (!instance) return res.status(404).json({ error: "Not found" });

  const expiresAt = Number(req.body.expiresAt);
  if (!Number.isFinite(expiresAt)) return res.status(400).json({ error: "expiresAt must be a number (ms)" });

  db.prepare("UPDATE game_instances SET expires_at = ? WHERE id = ?").run(expiresAt, instance.id);
  res.json({ ok: true, expiresAt });
});

module.exports = router;
