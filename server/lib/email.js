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

// One shared wrapper so every email — answer notifications, contact
// messages, receipts — reads as the same product instead of each having
// its own one-off header. Plain inline styles throughout (no <style>
// block, no flexbox/grid): email clients strip or mangle both.
function emailShell({ kicker = "JoueJoue", bodyHtml }) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #332a22;">
      <p style="text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; font-weight: 700; color: #cf5d3b; margin: 0 0 20px;">${escapeHtml(kicker)}</p>
      ${bodyHtml}
      <p style="color: #a89a8d; font-size: 12px; margin: 28px 0 0; padding-top: 16px; border-top: 1px solid #ecdfc9;">A tiny gesture, sent as a game.</p>
    </div>
  `;
}

// The order-summary block reused by both receipt emails — a plain table
// (not flex/grid) so it survives Outlook's stripped-down CSS support.
function receiptSummaryRow(label, value) {
  return `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #ecdfc9; font-size: 15px; color: #6f6258;">${escapeHtml(label)}</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #ecdfc9; font-size: 15px; font-weight: 700; text-align: right;">${escapeHtml(value)}</td>
    </tr>
  `;
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

// Fire-and-forget on purpose: whatever triggered this (an answer, a
// purchase, a contact message) is already saved by the time this is
// called, so a slow or failed email should never hold up or fail the
// visitor's own request. Errors are caught and logged here, not thrown.
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
      html: emailShell({
        bodyHtml: `
          <h1 style="font-size: 22px; margin: 0 0 16px; line-height: 1.3;">${escapeHtml(recipientName)} answered your question!</h1>
          <p style="margin: 0 0 4px; color: #6f6258; font-size: 14px;">You asked (via ${escapeHtml(templateName)}):</p>
          <p style="margin: 0 0 20px; font-size: 16px;">${escapeHtml(question)}</p>
          <div style="background: #fbf1e6; border-radius: 12px; padding: 16px 18px;">
            <p style="margin: 0 0 4px; color: #6f6258; font-size: 14px;">Their answer:</p>
            <p style="margin: 0; font-size: 18px; font-weight: 700;">${escapeHtml(answer)}</p>
          </div>
        `,
      }),
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
      html: emailShell({
        kicker: "JoueJoue · Contact form",
        bodyHtml: `
          <h1 style="font-size: 22px; margin: 0 0 16px;">${escapeHtml(name)}</h1>
          <p style="margin: 0 0 20px; color: #6f6258; font-size: 14px;">${escapeHtml(email)} &mdash; reply directly to this email to reach them.</p>
          <div style="background: #fbf1e6; border-radius: 12px; padding: 16px 18px;">
            <p style="margin: 0; font-size: 16px; white-space: pre-wrap;">${escapeHtml(message)}</p>
          </div>
        `,
      }),
    });
    return;
  }

  logStub("contact message", [["To", to], ["Name", name], ["Email", email], ["Message", message]]);
}

// Sent right after a bank-game purchase completes (server/routes/purchase.js,
// POST /api/instances) — the mock-checkout equivalent of an order receipt.
function sendPurchaseReceipt({ buyerEmail, templateName, recipientName, priceDisplay, shareUrl }) {
  const mode = process.env.EMAIL_MODE || "console";
  const subject = `Receipt: ${templateName} for ${recipientName}`;

  if (mode === "resend") {
    sendViaResend({
      to: buyerEmail,
      subject,
      html: emailShell({
        kicker: "JoueJoue · Receipt",
        bodyHtml: `
          <h1 style="font-size: 22px; margin: 0 0 16px;">Thanks — it's on its way to ${escapeHtml(recipientName)}.</h1>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            ${receiptSummaryRow(templateName, priceDisplay)}
            ${receiptSummaryRow("For", recipientName)}
            ${receiptSummaryRow("Live for", "1 month")}
          </table>
          <p style="margin: 0 0 6px; color: #6f6258; font-size: 14px;">Their link:</p>
          <p style="margin: 0 0 20px; font-size: 15px; word-break: break-all;"><a href="${escapeHtml(shareUrl)}" style="color: #cf5d3b;">${escapeHtml(shareUrl)}</a></p>
          <p style="color: #a89a8d; font-size: 12px; margin: 0;">This is a prototype — no card processor is connected and no money actually moved.</p>
        `,
      }),
    });
    return;
  }

  logStub("purchase receipt", [["To", buyerEmail], ["Game", templateName], ["For", recipientName], ["Price", priceDisplay], ["Link", shareUrl]]);
}

// Sent right after a renewal completes (server/routes/play.js, POST /renew/:token).
function sendRenewalReceipt({ buyerEmail, templateName, recipientName, priceDisplay, newExpiryDate, shareUrl }) {
  const mode = process.env.EMAIL_MODE || "console";
  const subject = `Receipt: ${templateName} renewed for another month`;

  if (mode === "resend") {
    sendViaResend({
      to: buyerEmail,
      subject,
      html: emailShell({
        kicker: "JoueJoue · Receipt",
        bodyHtml: `
          <h1 style="font-size: 22px; margin: 0 0 16px;">Renewed — ${escapeHtml(recipientName)}'s link stays live.</h1>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            ${receiptSummaryRow(`${templateName} — renewal`, priceDisplay)}
            ${receiptSummaryRow("New expiry", newExpiryDate)}
          </table>
          <p style="margin: 0 0 6px; color: #6f6258; font-size: 14px;">The link, unchanged:</p>
          <p style="margin: 0 0 20px; font-size: 15px; word-break: break-all;"><a href="${escapeHtml(shareUrl)}" style="color: #cf5d3b;">${escapeHtml(shareUrl)}</a></p>
          <p style="color: #a89a8d; font-size: 12px; margin: 0;">This is a prototype — no card processor is connected and no money actually moved.</p>
        `,
      }),
    });
    return;
  }

  logStub("renewal receipt", [["To", buyerEmail], ["Game", templateName], ["For", recipientName], ["Price", priceDisplay], ["New expiry", newExpiryDate], ["Link", shareUrl]]);
}

// Sent right after a custom-game request is submitted (server/routes/customRequest.js,
// POST /api/custom-requests) — this tier is paid up front via /custom-payment/:templateId
// but has no share link yet, so the receipt confirms the idea/purpose we received instead.
function sendCustomRequestReceipt({ buyerEmail, templateName, priceDisplay, gameIdea, purpose }) {
  const mode = process.env.EMAIL_MODE || "console";
  const subject = `Receipt: ${templateName} request received`;

  if (mode === "resend") {
    sendViaResend({
      to: buyerEmail,
      subject,
      html: emailShell({
        kicker: "JoueJoue · Receipt",
        bodyHtml: `
          <h1 style="font-size: 22px; margin: 0 0 16px;">Got it — we're building your custom game.</h1>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            ${receiptSummaryRow(templateName, priceDisplay)}
          </table>
          <p style="margin: 0 0 6px; color: #6f6258; font-size: 14px;">What you told us:</p>
          <div style="background: #fbf1e6; border-radius: 12px; padding: 16px 18px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px; font-size: 15px; white-space: pre-wrap;"><strong>Idea:</strong> ${escapeHtml(gameIdea)}</p>
            <p style="margin: 0; font-size: 15px; white-space: pre-wrap;"><strong>For:</strong> ${escapeHtml(purpose)}</p>
          </div>
          <p style="color: #a89a8d; font-size: 12px; margin: 0;">We'll reply by email with your link once it's ready. This is a prototype — no card processor is connected and no money actually moved.</p>
        `,
      }),
    });
    return;
  }

  logStub("custom request receipt", [["To", buyerEmail], ["Game", templateName], ["Price", priceDisplay], ["Idea", gameIdea], ["Purpose", purpose]]);
}

module.exports = { sendAnswerNotification, sendContactNotification, sendPurchaseReceipt, sendRenewalReceipt, sendCustomRequestReceipt };
