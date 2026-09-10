const express = require("express");
const QRCode = require("qrcode");
const db = require("../db");
const { sendCompanyRequestNotification } = require("../lib/email");
const { resolveCurrency, withLocalizedPrice, localizedPrice } = require("../lib/pricing");
const { generatePersonalizedToken } = require("../lib/tokens");
const { computeExpiry } = require("../lib/expiry");
const { lookupCountryCode } = require("../lib/geo");
const { recordReceipt } = require("../lib/receipts");
const {
  CODE_PRICE,
  MIN_QUANTITY,
  MAX_QUANTITY,
  generateShortcode,
  getCompanyByToken,
  batchStats,
} = require("../lib/companies");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEVELS = ["easy", "medium", "hard"];
const MODES = ["fixed", "personalized"];

// ---------------------------------------------------------------------------
// Phase A: pitch + request-access
// ---------------------------------------------------------------------------
router.get("/for-companies", (req, res) => {
  res.render("for-companies");
});

router.post("/api/company-requests", (req, res) => {
  const companyName = String(req.body.companyName || "").trim();
  const contactName = String(req.body.contactName || "").trim();
  const contactEmail = String(req.body.contactEmail || "").trim();
  const sells = String(req.body.sells || "").trim();
  const volume = String(req.body.volume || "").trim();
  const message = String(req.body.message || "").trim();

  if (!companyName) return res.status(400).send("Please enter your company name.");
  if (!contactName) return res.status(400).send("Please enter your name.");
  if (!EMAIL_RE.test(contactEmail)) return res.status(400).send("Please enter a valid email.");

  db.prepare(
    "INSERT INTO company_requests (company_name, contact_name, contact_email, sells, volume, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(companyName, contactName, contactEmail, sells, volume, message, Date.now());

  sendCompanyRequestNotification({ companyName, contactName, contactEmail, sells, volume, message });

  res.render("for-companies-thanks", { contactEmail });
});

// ---------------------------------------------------------------------------
// Company dashboard (magic-link, same pattern as subscriptions)
// ---------------------------------------------------------------------------
function loadCompanyOr404(req, res) {
  const company = getCompanyByToken(req.params.manageToken);
  if (!company) {
    res.status(404).render("expired", { message: "That dashboard link doesn't exist." });
    return null;
  }
  return company;
}

router.get("/company/:manageToken", async (req, res) => {
  const company = loadCompanyOr404(req, res);
  if (!company) return;
  const currency = await resolveCurrency(req);
  const batches = db
    .prepare("SELECT * FROM company_batches WHERE company_id = ? ORDER BY id DESC")
    .all(company.id)
    .map((b) => {
      const template = db.prepare("SELECT name FROM game_templates WHERE id = ?").get(b.template_id);
      return { ...b, templateName: template ? template.name : "(none)", stats: batchStats(b.id) };
    });
  res.render("company-dashboard", { company, batches });
});

router.get("/company/:manageToken/batch/new", async (req, res) => {
  const company = loadCompanyOr404(req, res);
  if (!company) return;
  const currency = await resolveCurrency(req);
  const templates = db.prepare("SELECT id, name FROM game_templates WHERE is_custom_tier = 0 ORDER BY id ASC").all();
  res.render("company-batch-new", {
    company,
    templates,
    perCode: localizedPrice(CODE_PRICE, currency),
    minQuantity: MIN_QUANTITY,
    maxQuantity: MAX_QUANTITY,
  });
});

// Mock checkout: shows the chosen config + total with card fields, then
// posts to /api/company-batches. Never reads a card field, same as every
// other checkout here.
router.post("/company/:manageToken/batch/checkout", async (req, res) => {
  const company = loadCompanyOr404(req, res);
  if (!company) return;

  const config = readBatchConfig(req.body);
  const err = validateBatchConfig(config);
  if (err) return res.status(400).send(err);

  const currency = await resolveCurrency(req);
  const perCodeCents = CODE_PRICE.price_usd_cents;
  const totalTemplate = {
    price_egp: CODE_PRICE.price_egp * config.quantity,
    price_usd_cents: perCodeCents * config.quantity,
  };
  res.render("company-batch-checkout", {
    company,
    config,
    templateName: db.prepare("SELECT name FROM game_templates WHERE id = ?").get(config.templateId).name,
    perCode: localizedPrice(CODE_PRICE, currency),
    total: localizedPrice(totalTemplate, currency),
  });
});

function readBatchConfig(body) {
  return {
    templateId: Number(body.templateId),
    level: LEVELS.includes(body.level) ? body.level : "medium",
    mode: MODES.includes(body.mode) ? body.mode : "fixed",
    defaultQuestion: String(body.defaultQuestion || "").trim(),
    answersTo: body.answersTo === "company" ? "company" : "buyer",
    quantity: Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, Math.floor(Number(body.quantity) || 0))),
    logoUrl: String(body.logoUrl || "").trim(),
    accentColor: String(body.accentColor || "").trim(),
  };
}

function validateBatchConfig(c) {
  const template = db.prepare("SELECT id FROM game_templates WHERE id = ? AND is_custom_tier = 0").get(c.templateId);
  if (!template) return "Pick a game.";
  if (!c.quantity || c.quantity < MIN_QUANTITY) return `Minimum order is ${MIN_QUANTITY} codes.`;
  if (c.mode === "fixed" && !c.defaultQuestion) return "A fixed batch needs a question.";
  if (c.accentColor && !/^#[0-9a-fA-F]{3,8}$/.test(c.accentColor)) return "Accent colour must be a hex value like #cf5d3b.";
  if (c.logoUrl && !/^https:\/\/\S+$/.test(c.logoUrl)) return "Logo URL must be a full https:// address.";
  return null;
}

router.post("/company/:manageToken/batches", async (req, res) => {
  const company = loadCompanyOr404(req, res);
  if (!company) return;

  const config = readBatchConfig(req.body);
  const err = validateBatchConfig(config);
  if (err) return res.status(400).send(err);

  const currency = await resolveCurrency(req);
  // Fixed batches have no gift-buyer to email, so their answers go to the
  // company by default even though 'buyer' is the site-wide default.
  const answersTo = config.mode === "fixed" ? config.answersTo : "buyer";
  const totalTemplate = {
    price_egp: CODE_PRICE.price_egp * config.quantity,
    price_usd_cents: CODE_PRICE.price_usd_cents * config.quantity,
  };
  const priceDisplay = localizedPrice(totalTemplate, currency);
  const now = Date.now();

  const batchId = db
    .prepare(
      `INSERT INTO company_batches
       (company_id, template_id, level, mode, default_question, answers_to, quantity, price_display, currency, logo_url, accent_color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      company.id,
      config.templateId,
      config.level,
      config.mode,
      config.defaultQuestion,
      answersTo,
      config.quantity,
      priceDisplay,
      currency,
      config.logoUrl || company.logo_url || "",
      config.accentColor || company.accent_color || "",
      now
    ).lastInsertRowid;

  const insertCode = db.prepare(
    "INSERT INTO company_codes (batch_id, shortcode, personalized, created_at) VALUES (?, ?, 0, ?)"
  );
  const shortcodeTaken = db.prepare("SELECT 1 FROM company_codes WHERE shortcode = ?");
  const makeCodes = db.transaction((n) => {
    for (let i = 0; i < n; i++) {
      let sc;
      do {
        sc = generateShortcode();
      } while (shortcodeTaken.get(sc));
      insertCode.run(batchId, sc, now);
    }
  });
  makeCodes(config.quantity);

  const templateName = db.prepare("SELECT name FROM game_templates WHERE id = ?").get(config.templateId).name;
  recordReceipt({
    kind: "company_batch",
    buyerEmail: company.contact_email,
    buyerName: company.name,
    itemName: `${templateName} · QR batch`,
    itemDetail: `${config.quantity} codes, ${config.mode}`,
    amountDisplay: priceDisplay,
    currency,
  });

  res.redirect(`/company/${company.manage_token}/batch/${batchId}`);
});

router.get("/company/:manageToken/batch/:batchId", (req, res) => {
  const company = loadCompanyOr404(req, res);
  if (!company) return;
  const batch = db
    .prepare("SELECT * FROM company_batches WHERE id = ? AND company_id = ?")
    .get(req.params.batchId, company.id);
  if (!batch) return res.status(404).render("expired", { message: "That batch doesn't exist." });
  const templateName = db.prepare("SELECT name FROM game_templates WHERE id = ?").get(batch.template_id).name;
  const codes = db.prepare("SELECT * FROM company_codes WHERE batch_id = ? ORDER BY id ASC").all(batch.id);
  res.render("company-batch-detail", {
    company,
    batch,
    templateName,
    codes,
    stats: batchStats(batch.id),
    baseUrl: `${req.protocol}://${req.get("host")}`,
  });
});

// Printable contact sheet: every code's QR, ready to print and cut.
router.get("/company/:manageToken/batch/:batchId/sheet", async (req, res) => {
  const company = loadCompanyOr404(req, res);
  if (!company) return;
  const batch = db
    .prepare("SELECT * FROM company_batches WHERE id = ? AND company_id = ?")
    .get(req.params.batchId, company.id);
  if (!batch) return res.status(404).render("expired", { message: "That batch doesn't exist." });
  const codes = db.prepare("SELECT * FROM company_codes WHERE batch_id = ? ORDER BY id ASC").all(batch.id);
  const base = `${req.protocol}://${req.get("host")}`;
  const withQr = await Promise.all(
    codes.map(async (c) => ({
      shortcode: c.shortcode,
      url: `${base}/g/${c.shortcode}`,
      qr: await QRCode.toDataURL(`${base}/g/${c.shortcode}`, { margin: 1, width: 220 }),
    }))
  );
  res.render("company-batch-sheet", { company, batch, codes: withQr });
});

router.get("/company/:manageToken/batch/:batchId/codes.csv", (req, res) => {
  const company = loadCompanyOr404(req, res);
  if (!company) return;
  const batch = db
    .prepare("SELECT * FROM company_batches WHERE id = ? AND company_id = ?")
    .get(req.params.batchId, company.id);
  if (!batch) return res.status(404).render("expired", { message: "That batch doesn't exist." });
  const codes = db.prepare("SELECT * FROM company_codes WHERE batch_id = ? ORDER BY id ASC").all(batch.id);
  const base = `${req.protocol}://${req.get("host")}`;
  const rows = ["shortcode,url"].concat(codes.map((c) => `${c.shortcode},${base}/g/${c.shortcode}`));
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="batch-${batch.id}-codes.csv"`);
  res.send(rows.join("\n"));
});

// ---------------------------------------------------------------------------
// The dynamic QR endpoint — logs the scan, then routes to the game
// ---------------------------------------------------------------------------
function loadCodeWithBatch(shortcode) {
  const code = db.prepare("SELECT * FROM company_codes WHERE shortcode = ?").get(shortcode);
  if (!code) return null;
  const batch = db.prepare("SELECT * FROM company_batches WHERE id = ?").get(code.batch_id);
  const template = db.prepare("SELECT * FROM game_templates WHERE id = ?").get(batch.template_id);
  return { code, batch, template };
}

async function logScan(req, codeId) {
  let countryCode = null;
  try {
    countryCode = await lookupCountryCode(req.ip);
  } catch (err) {
    /* geo lookup is best-effort */
  }
  db.prepare("INSERT INTO code_scans (code_id, scanned_at, country_code, user_agent) VALUES (?, ?, ?, ?)").run(
    codeId,
    Date.now(),
    countryCode,
    String(req.get("user-agent") || "").slice(0, 300)
  );
}

function createInstanceForCode(found, { question, note, buyerEmail, recipientName, senderName }) {
  const { code, batch, template } = found;
  const isTaken = (candidate) => !!db.prepare("SELECT 1 FROM game_instances WHERE token = ?").get(candidate);
  const token = generatePersonalizedToken(recipientName || batch.default_question || "gift", isTaken);
  const now = Date.now();
  db.prepare(`
    INSERT INTO game_instances (template_id, token, buyer_email, recipient_name, question, status, created_at, expires_at, sender_name, note, delivery_method, recipient_email, level)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 'link', NULL, ?)
  `).run(
    template.id,
    token,
    buyerEmail || "",
    recipientName || "",
    question,
    now,
    computeExpiry(now),
    senderName || "",
    note || "",
    batch.level
  );
  db.prepare("UPDATE company_codes SET instance_token = ?, personalized = 1 WHERE id = ?").run(token, code.id);
  return token;
}

function companyName(companyId) {
  const row = db.prepare("SELECT name FROM companies WHERE id = ?").get(companyId);
  return row ? row.name : "";
}

router.get("/g/:shortcode", async (req, res) => {
  const found = loadCodeWithBatch(req.params.shortcode);
  if (!found) return res.status(404).render("expired", { message: "That code isn't recognised." });
  await logScan(req, found.code.id);

  if (found.code.instance_token) {
    return res.redirect(`/play/${found.code.instance_token}`);
  }
  if (found.batch.mode === "personalized") {
    return res.redirect(`/g/${req.params.shortcode}/setup`);
  }
  // Fixed: create the instance now, on first scan. The company is the
  // sender and (for a fixed batch) the answer recipient.
  const token = createInstanceForCode(found, {
    question: found.batch.default_question,
    buyerEmail:
      found.batch.answers_to === "company"
        ? db.prepare("SELECT contact_email FROM companies WHERE id = ?").get(found.batch.company_id).contact_email
        : "",
    recipientName: "",
    senderName: companyName(found.batch.company_id),
  });
  res.redirect(`/play/${token}`);
});

router.get("/g/:shortcode/setup", (req, res) => {
  const found = loadCodeWithBatch(req.params.shortcode);
  if (!found) return res.status(404).render("expired", { message: "That code isn't recognised." });
  if (found.batch.mode !== "personalized") return res.redirect(`/g/${req.params.shortcode}`);
  if (found.code.instance_token) {
    const shareUrl = `${req.protocol}://${req.get("host")}/play/${found.code.instance_token}`;
    return res.render("company-code-ready", { shareUrl });
  }
  res.render("company-code-setup", { shortcode: req.params.shortcode, batch: found.batch, template: found.template });
});

router.post("/g/:shortcode/setup", (req, res) => {
  const found = loadCodeWithBatch(req.params.shortcode);
  if (!found) return res.status(404).render("expired", { message: "That code isn't recognised." });
  if (found.code.instance_token) return res.redirect(`/g/${req.params.shortcode}`);
  if (found.batch.mode !== "personalized") return res.redirect(`/g/${req.params.shortcode}`);

  const question = String(req.body.question || "").trim();
  const note = String(req.body.note || "").trim();
  const buyerEmail = String(req.body.buyerEmail || "").trim();
  const recipientName = String(req.body.recipientName || "").trim();
  const senderName = String(req.body.senderName || "").trim();
  if (!question) return res.status(400).send("Please write a question.");
  if (!EMAIL_RE.test(buyerEmail)) return res.status(400).send("Please enter a valid email for the answer.");

  const token = createInstanceForCode(found, { question, note, buyerEmail, recipientName, senderName });
  const shareUrl = `${req.protocol}://${req.get("host")}/play/${token}`;
  res.render("company-code-ready", { shareUrl });
});

module.exports = router;
