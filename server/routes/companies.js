const express = require("express");
const db = require("../db");
const { sendCompanyRequestNotification } = require("../lib/email");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phase A: the pitch + request-access enquiry. Onboarding is manual — this
// form just gets a company on an operator's radar; provisioning (a
// companies row + a dashboard magic link) happens separately.
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

module.exports = router;
