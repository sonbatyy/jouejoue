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
    });
  }

  if (cardCvc) {
    cardCvc.addEventListener("input", () => {
      cardCvc.value = cardCvc.value.replace(/\D/g, "").slice(0, 4);
    });
  }
});
