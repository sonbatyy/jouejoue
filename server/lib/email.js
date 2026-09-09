const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");

const OUTBOX_PATH = path.join(__dirname, "..", "..", "data", "outbox.log");

// Buyer/recipient-supplied text rendered into an HTML email for someone
// else — same reasoning as the site's textContent-only rule elsewhere,
// just for HTML email bodies where there's no DOM to lean on.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let resendClient = null;
function getResendClient() {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set. Add it to your .env before using EMAIL_MODE=resend.");
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Fire-and-forget on purpose: whatever triggered this (an answer, a contact
// message) is already saved by the time this is called, so a slow or
// failed email should never hold up or fail the visitor's own request.
// Errors are caught and logged here, not thrown.
async function sendViaResend({ to, subject, html, replyTo }) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || "answers@joue-joue.com";
  try {
    const resend = getResendClient();
    await resend.emails.send({
      from: `JoueJoue <${fromAddress}>`,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
  } catch (err) {
    console.error("Resend send failed:", (err && err.message) || err);
  }
}

function logStub(label, lines) {
  console.log(`\n--- ${label} (stub) ---`);
  lines.forEach(([key, value]) => console.log(`${key}: ${value}`));
  console.log("-------------------------------\n");
}

/**
 * Pluggable notification sender. Swap EMAIL_MODE to change delivery without
 * touching any call site — the same pattern as jinder's changePlan()/CV
 * parser. EMAIL_MODE=resend actually sends via Resend's API once
 * RESEND_API_KEY and the sending domain are set up; "file"/"console" stay
 * as dev-only stubs for testing without spending real sends.
 */
function sendAnswerNotification({ buyerEmail, templateName, recipientName, question, answer, instanceToken }) {
  const mode = process.env.EMAIL_MODE || "console";
  const subject = `New answer: "${answer}"`;

  if (mode === "resend") {
    sendViaResend({
      to: buyerEmail,
      subject,
      html: `
        <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #332a22;">
          <p style="text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; font-weight: 700; color: #cf5d3b; margin: 0 0 8px;">JoueJoue</p>
          <h1 style="font-size: 22px; margin: 0 0 16px; line-height: 1.3;">${escapeHtml(recipientName)} answered your question!</h1>
          <p style="margin: 0 0 4px; color: #6f6258; font-size: 14px;">You asked (via ${escapeHtml(templateName)}):</p>
          <p style="margin: 0 0 20px; font-size: 16px;">${escapeHtml(question)}</p>
          <div style="background: #fbf1e6; border-radius: 12px; padding: 16px 18px; margin-bottom: 20px;">
            <p style="margin: 0 0 4px; color: #6f6258; font-size: 14px;">Their answer:</p>
            <p style="margin: 0; font-size: 18px; font-weight: 700;">${escapeHtml(answer)}</p>
          </div>
          <p style="color: #a89a8d; font-size: 12px; margin: 0;">Sent by JoueJoue — a tiny gesture, sent as a game.</p>
        </div>
      `,
    });
    return;
  }

  const payload = { to: buyerEmail, subject, game: templateName, from: recipientName, question, answer, instanceToken, sentAt: new Date().toISOString() };
  if (mode === "file") {
    fs.appendFileSync(OUTBOX_PATH, JSON.stringify(payload) + "\n");
    return;
  }
  logStub("answer notification", Object.entries(payload));
}

// The contact form (views/contact.ejs) used to only save to the DB with no
// actual notification — nobody would know a message came in without going
// to look. This is what makes it actually reach an inbox.
function sendContactNotification({ name, email, message }) {
  const mode = process.env.EMAIL_MODE || "console";
  const to = process.env.CONTACT_EMAIL_TO || "contact@joue-joue.com";
  const subject = `New contact message from ${name}`;

  if (mode === "resend") {
    sendViaResend({
      to,
      subject,
      replyTo: email, // reply in your mail client and it reaches the sender, not answers@
      html: `
        <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #332a22;">
          <p style="text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; font-weight: 700; color: #cf5d3b; margin: 0 0 8px;">JoueJoue &middot; Contact form</p>
          <h1 style="font-size: 22px; margin: 0 0 16px;">${escapeHtml(name)}</h1>
          <p style="margin: 0 0 20px; color: #6f6258; font-size: 14px;">${escapeHtml(email)} &mdash; reply directly to this email to reach them.</p>
          <div style="background: #fbf1e6; border-radius: 12px; padding: 16px 18px;">
            <p style="margin: 0; font-size: 16px; white-space: pre-wrap;">${escapeHtml(message)}</p>
          </div>
        </div>
      `,
    });
    return;
  }

  logStub("contact message", [["To", to], ["Name", name], ["Email", email], ["Message", message]]);
}

module.exports = { sendAnswerNotification, sendContactNotification };
