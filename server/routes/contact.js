const express = require("express");
const db = require("../db");
const { sendContactNotification } = require("../lib/email");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/contact", (req, res) => {
  res.render("contact");
});

router.post("/api/contact-messages", (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim();
  const message = String(req.body.message || "").trim();

  if (!name) return res.status(400).send("Please enter your name.");
  if (!EMAIL_RE.test(email)) return res.status(400).send("Please enter a valid email.");
  if (!message) return res.status(400).send("Please write a message.");

  db.prepare("INSERT INTO contact_messages (name, email, message, created_at) VALUES (?, ?, ?, ?)").run(
    name,
    email,
    message,
    Date.now()
  );

  sendContactNotification({ name, email, message });

  res.render("contact-thanks", { name });
});

module.exports = router;
