// Floating emoji background — a lazy wander loop behind every page's
// content (views/layout-partials/page-bg.ejs). Fixed to the viewport (like
// .page-bg) so it roams the whole screen, not just one section. Tapping one
// freezes it in place and pops a confetti burst from GameLib (shared.js),
// reusing the exact same burst that fires when someone wins a game.
(function () {
  const field = document.getElementById("pageEmojiField");
  if (!field || !window.GameLib) return;

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const EMOJIS = ["🎮", "🍰", "🦆", "🐦", "🍓", "🎉", "✨", "🎈", "🥳", "🍭"];
  const COUNT = 14; // was 24 on the games page alone — a little less, now that it's everywhere

  // A random waypoint in viewport units, so the wander distance scales with
  // screen size instead of being a fixed pixel amount that reads as huge on
  // a phone and tiny on a monitor.
  function randomVw() {
    return `${(Math.random() * 60 - 30).toFixed(1)}vw`;
  }
  function randomVh() {
    return `${(Math.random() * 50 - 25).toFixed(1)}vh`;
  }

  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement("span");
    el.className = "emoji-field__item";
    el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    el.style.left = `${Math.random() * 96}%`;
    el.style.top = `${Math.random() * 92}%`;
    el.style.fontSize = `${18 + Math.random() * 18}px`;
    el.style.opacity = String(0.32 + Math.random() * 0.38);
    if (!reduceMotion) {
      el.style.animationDuration = `${16 + Math.random() * 18}s`;
      el.style.animationDelay = `${-Math.random() * 20}s`;
      el.style.setProperty("--dx1", randomVw());
      el.style.setProperty("--dy1", randomVh());
      el.style.setProperty("--dx2", randomVw());
      el.style.setProperty("--dy2", randomVh());
      el.style.setProperty("--dx3", randomVw());
      el.style.setProperty("--dy3", randomVh());
      el.style.setProperty("--dx4", randomVw());
      el.style.setProperty("--dy4", randomVh());
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
