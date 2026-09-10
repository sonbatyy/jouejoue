const crypto = require("crypto");
const db = require("../db");

// Per-code price for a company batch — a flat B2B rate, and cheaper per
// unit than a one-off bank game because it's bulk and self-fulfilled (the
// company prints and attaches the codes itself). Same {price_egp,
// price_usd_cents} shape as RENEWAL_PRICE so localizedPrice() works on it.
const CODE_PRICE = { price_egp: 40, price_usd_cents: 100 };
const MIN_QUANTITY = 10;
const MAX_QUANTITY = 1000;

function generateManageToken() {
  return crypto.randomBytes(20).toString("base64url");
}

// Short, url-safe, and free of confusable characters (no 0/o/1/l/i) — this
// gets printed under the QR so a person could type it in a pinch.
const SHORTCODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function generateShortcode(len = 7) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += SHORTCODE_ALPHABET[bytes[i] % SHORTCODE_ALPHABET.length];
  return out;
}

function getCompanyByToken(manageToken) {
  return db.prepare("SELECT * FROM companies WHERE manage_token = ?").get(manageToken);
}

// The dynamic-QR funnel for one batch: how many codes exist, how many have
// been scanned at least once, how many turned into a real game, how many
// got answered.
function batchStats(batchId) {
  const total = db.prepare("SELECT COUNT(*) n FROM company_codes WHERE batch_id = ?").get(batchId).n;
  const scanned = db
    .prepare(
      "SELECT COUNT(DISTINCT cs.code_id) n FROM code_scans cs JOIN company_codes cc ON cc.id = cs.code_id WHERE cc.batch_id = ?"
    )
    .get(batchId).n;
  const played = db
    .prepare("SELECT COUNT(*) n FROM company_codes WHERE batch_id = ? AND instance_token IS NOT NULL")
    .get(batchId).n;
  const answered = db
    .prepare(
      `SELECT COUNT(*) n FROM company_codes cc
       JOIN game_instances gi ON gi.token = cc.instance_token
       WHERE cc.batch_id = ? AND gi.status = 'answered'`
    )
    .get(batchId).n;
  return { total, scanned, played, answered };
}

module.exports = {
  CODE_PRICE,
  MIN_QUANTITY,
  MAX_QUANTITY,
  generateManageToken,
  generateShortcode,
  getCompanyByToken,
  batchStats,
};
