// Swaps the displayed price instantly when the visitor picks a different
// currency, using prices already computed server-side (window.__PRICES__) —
// no reload, no re-guessing their location. Purely cosmetic: the actual
// charge (were this wired to a real processor) always happens in whatever
// currency the server detected, per the fine print on this page.
(function () {
  const select = document.getElementById("currencySelect");
  const priceEl = document.getElementById("orderPrice");
  const payBtn = document.getElementById("payButton");
  if (!select || !window.__PRICES__) return;

  select.addEventListener("change", () => {
    const price = window.__PRICES__[select.value];
    if (!price) return;
    if (priceEl) priceEl.textContent = price;
    if (payBtn) payBtn.textContent = `Pay ${price}`;
  });
})();
