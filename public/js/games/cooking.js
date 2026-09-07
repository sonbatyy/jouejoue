// Self-contained: builds its own DOM inside containerEl. A recipe strip up
// top shows the required order; scattered ingredient tiles below. Click
// them in the right order to advance. Wrong clicks are just ignored rather
// than punished — easy on purpose right now, this is a prototype and we're
// testing the win flow, not tuning difficulty.
function initCooking({ containerEl, onWin }) {
  const RECIPE = [
    { emoji: "🍅", label: "tomato" },
    { emoji: "🧅", label: "onion" },
    { emoji: "🧄", label: "garlic" },
    { emoji: "🍗", label: "chicken" },
  ];

  containerEl.innerHTML = `
    <div class="play-instructions">Add the ingredients in order.</div>
    <div class="recipe-strip"></div>
    <div class="ingredient-board"></div>
  `;

  const strip = containerEl.querySelector(".recipe-strip");
  const board = containerEl.querySelector(".ingredient-board");
  let step = 0;

  RECIPE.forEach((ingredient) => {
    const slot = document.createElement("div");
    slot.className = "recipe-slot";
    slot.textContent = ingredient.emoji;
    strip.appendChild(slot);
  });

  function updateStrip() {
    const slots = strip.querySelectorAll(".recipe-slot");
    slots.forEach((slot, i) => {
      slot.classList.toggle("done", i < step);
      slot.classList.toggle("current", i === step);
    });
  }
  updateStrip();

  // Shuffle a copy so the scattered tiles aren't in recipe order.
  const shuffled = [...RECIPE].sort(() => Math.random() - 0.5);
  shuffled.forEach((ingredient) => {
    const tile = document.createElement("div");
    tile.className = "ingredient-tile";
    tile.textContent = ingredient.emoji;
    tile.addEventListener("click", () => tryAdd(ingredient, tile));
    board.appendChild(tile);
  });

  function tryAdd(ingredient, tile) {
    if (tile.classList.contains("used")) return;
    if (ingredient.label !== RECIPE[step].label) return; // wrong pick, just ignored

    tile.classList.add("used");
    step += 1;
    updateStrip();

    if (step === RECIPE.length) {
      setTimeout(onWin, 400);
    }
  }
}
