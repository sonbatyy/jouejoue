// Floating emoji background for the games page — a lazy drift loop behind
// the catalog cards. Tapping one freezes it in place and pops a confetti
// burst from GameLib (shared.js), reusing the exact same burst that fires
// when someone wins a game elsewhere on the site.
(function () {
  const field = document.getElementById("gamesEmojiField");
  if (!field || !window.GameLib) return;

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const EMOJIS = ["🎮", "🍰", "🦆", "🐦", "🍓", "🎉", "✨", "🎈"];
  const COUNT = 14;

  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement("span");
    el.className = "emoji-field__item";
    el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    el.style.left = `${2 + Math.random() * 92}%`;
    el.style.top = `${2 + Math.random() * 90}%`;
    el.style.fontSize = `${18 + Math.random() * 16}px`;
    el.style.opacity = String(0.3 + Math.random() * 0.35);
    if (!reduceMotion) {
      el.style.animationDuration = `${9 + Math.random() * 8}s`;
      el.style.animationDelay = `${-Math.random() * 12}s`;
    }

    el.addEventListener("click", () => {
      if (el.classList.contains("is-paused")) return; // already popped, ignore repeat taps
      el.classList.add("is-paused");
      const rect = el.getBoundingClientRect();
      window.GameLib.confetti({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, count: 20 });
    });

    field.appendChild(el);
  }
})();
