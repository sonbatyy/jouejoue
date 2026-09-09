// Live input formatting for the mock checkout form: groups the card number
// into 4s, auto-inserts the "/" in the expiry field. Purely cosmetic — this
// form never actually processes a card (see server/routes/purchase.js,
// which never even reads these fields), just makes typing into it feel like
// a real checkout.
document.addEventListener("DOMContentLoaded", () => {
  const cardNumber = document.getElementById("cardNumber");
  const cardExpiry = document.getElementById("cardExpiry");
  const cardCvc = document.getElementById("cardCvc");

  if (cardNumber) {
    cardNumber.addEventListener("input", () => {
      const digits = cardNumber.value.replace(/\D/g, "").slice(0, 16);
      cardNumber.value = digits.replace(/(.{4})/g, "$1 ").trim();
    });
  }

  if (cardExpiry) {
    cardExpiry.addEventListener("input", () => {
      const digits = cardExpiry.value.replace(/\D/g, "").slice(0, 4);
      cardExpiry.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;

      // Only judge it once a full MM/YY has been typed — clear any error
      // while still mid-entry so we're not flashing red at half a date.
      if (digits.length < 4) {
        cardExpiry.setCustomValidity("");
        return;
      }
      const month = Number(digits.slice(0, 2));
      const year = 2000 + Number(digits.slice(2, 4));
      const now = new Date();
      const thisMonth = now.getMonth() + 1;
      const thisYear = now.getFullYear();
      if (month < 1 || month > 12) {
        cardExpiry.setCustomValidity("Not a real month");
      } else if (year < thisYear || (year === thisYear && month < thisMonth)) {
        cardExpiry.setCustomValidity("This card has already expired");
      } else {
        cardExpiry.setCustomValidity("");
      }
    });
  }

  if (cardCvc) {
    cardCvc.addEventListener("input", () => {
      cardCvc.value = cardCvc.value.replace(/\D/g, "").slice(0, 4);
    });
  }
});
