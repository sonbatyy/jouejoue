const db = require("../db");

// JJ-YYYYMMDD-NNNN — a human-readable receipt number instead of a bare row
// id, so it reads like something a real invoicing system generated. NNNN is
// sequential per day (resets at UTC midnight), not globally sequential, so
// a single receipt number never leaks total lifetime order volume.
function generateReceiptNumber(now) {
  const date = new Date(now);
  const datePart = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const countToday = db
    .prepare("SELECT COUNT(*) AS n FROM receipts WHERE created_at >= ? AND created_at < ?")
    .get(dayStart, dayEnd).n;
  const seq = String(countToday + 1).padStart(4, "0");
  return `JJ-${datePart}-${seq}`;
}

/**
 * Records one completed mock payment — every paid flow (purchase, renewal,
 * custom request, subscription) calls this right after its own DB write, so
 * there's a persistent, itemized record beyond just an email that could get
 * lost. better-sqlite3 is synchronous and Node is single-threaded, so the
 * count-then-insert below never races across concurrent requests. Returns
 * the receipt number + timestamp, which is what the email/receipt page
 * actually render.
 */
function recordReceipt({ kind, buyerEmail, buyerName = "", itemName, itemDetail = "", amountDisplay, currency, relatedToken = null }) {
  const now = Date.now();
  const receiptNumber = generateReceiptNumber(now);
  db.prepare(`
    INSERT INTO receipts (receipt_number, kind, buyer_email, buyer_name, item_name, item_detail, amount_display, currency, related_token, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(receiptNumber, kind, buyerEmail, buyerName, itemName, itemDetail, amountDisplay, currency, relatedToken, now);
  return { receiptNumber, createdAt: now };
}

function getReceiptByNumber(receiptNumber) {
  return db.prepare("SELECT * FROM receipts WHERE receipt_number = ?").get(receiptNumber);
}

module.exports = { recordReceipt, getReceiptByNumber };
