const express = require("express");
const { getReceiptByNumber } = require("../lib/receipts");

const router = express.Router();

// Public by design (no ownership check against a logged-in buyer — there is
// no buyer account system in this app at all), but the receipt number is a
// per-day sequential + random-looking prefix, not a guessable id, and the
// page shows nothing more sensitive than what already went out in the
// receipt email itself.
router.get("/receipt/:receiptNumber", (req, res) => {
  const receipt = getReceiptByNumber(req.params.receiptNumber);
  if (!receipt) return res.status(404).render("expired", { message: "That receipt doesn't exist." });
  res.render("receipt", {
    receipt,
    dateDisplay: new Date(receipt.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
  });
});

module.exports = router;
