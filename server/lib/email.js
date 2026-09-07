const fs = require("fs");
const path = require("path");

const OUTBOX_PATH = path.join(__dirname, "..", "..", "data", "outbox.log");

/**
 * Pluggable notification sender. Swap EMAIL_MODE to change delivery without
 * touching any call site — the same pattern as jinder's changePlan()/CV
 * parser: a real provider (SMTP via nodemailer, or a transactional API like
 * Resend/SendGrid) drops in here later, once the user has their own
 * account/API key for it. Nothing here talks to a real mail server yet.
 */
function sendAnswerNotification({ buyerEmail, templateName, question, answer, instanceToken }) {
  const mode = process.env.EMAIL_MODE || "console";
  const payload = {
    to: buyerEmail,
    subject: `New answer: "${answer}"`,
    game: templateName,
    question,
    answer,
    instanceToken,
    sentAt: new Date().toISOString(),
  };

  if (mode === "file") {
    fs.appendFileSync(OUTBOX_PATH, JSON.stringify(payload) + "\n");
    return;
  }

  // default: console
  console.log("\n--- notification (stub) ---");
  console.log(`To: ${payload.to}`);
  console.log(`Subject: ${payload.subject}`);
  console.log(`Game: ${payload.game}`);
  console.log(`Question: ${payload.question}`);
  console.log(`Answer: ${payload.answer}`);
  console.log("-------------------------------\n");
}

module.exports = { sendAnswerNotification };
