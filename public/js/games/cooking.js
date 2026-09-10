// Appends its own wrapper inside containerEl rather than overwriting
// containerEl.innerHTML — see flappy-bird.js for why: containerEl is the
// whole .play-shell, and on the demo page that also holds the "Back to
// JoueJoue" button and the game switcher as siblings.
//
// Fruits and vegetables fall from the top. Each round picks one target at
// random — tap it to win. Tap anything else, or let the target fall past
// the bottom uncaught, and you lose. One shot, no partial credit, exactly
// as asked for. Falling is driven by a CSS transition (not
// requestAnimationFrame), so it keeps animating correctly even in
// contexts where rAF gets throttled.
const COOKING_LEVELS = {
  easy: { fallDurationMs: 5000, spawnIntervalMs: 1300, targetChance: 0.5 },
  medium: { fallDurationMs: 4000, spawnIntervalMs: 1100, targetChance: 0.35 },
  hard: { fallDurationMs: 3000, spawnIntervalMs: 900, targetChance: 0.25 },
};
function initCooking({ containerEl, onWin, onLose, level }) {
  const { fallDurationMs, spawnIntervalMs, targetChance } = COOKING_LEVELS[level] || COOKING_LEVELS.medium;
  const ITEMS = ["🍎", "🍌", "🍇", "🍊", "🍓", "🥕", "🥦", "🍆"];
  const FALL_DURATION_MS = fallDurationMs;
  const SPAWN_INTERVAL_MS = spawnIntervalMs;
  const TARGET_CHANCE = targetChance; // how often a spawn is the real target vs a decoy

  const wrapper = document.createElement("div");
  containerEl.appendChild(wrapper);

  let target, spawnTimer, resolved;

  function pickTarget() {
    target = ITEMS[Math.floor(Math.random() * ITEMS.length)];
  }

  function render() {
    wrapper.innerHTML = `
      <div class="play-instructions">Catch the right one. Miss it or tap the wrong one and you lose.</div>
      <div class="cooking-target-badge">Catch: <span class="cooking-target-emoji">${target}</span></div>
      <div class="overlay hidden cooking-gameover-overlay">
        <div class="modal-box">
          <h2>Missed it</h2>
          <p>That wasn't the right one. Try again!</p>
          <button type="button" class="btn btn-primary cooking-retry-btn">Try again</button>
        </div>
      </div>
    `;
    wrapper.querySelector(".cooking-retry-btn").addEventListener("click", startRound);
  }

  function startRound() {
    resolved = false;
    pickTarget();
    render();
    clearInterval(spawnTimer);
    spawnTimer = setInterval(spawnItem, SPAWN_INTERVAL_MS);
    spawnItem();
  }

  function spawnItem() {
    if (resolved) return;
    const emoji = Math.random() < TARGET_CHANCE ? target : ITEMS[Math.floor(Math.random() * ITEMS.length)];

    const el = document.createElement("div");
    el.className = "falling-item";
    el.textContent = emoji;
    const areaWidth = containerEl.clientWidth;
    const x = 20 + Math.random() * Math.max(0, areaWidth - 80);
    el.style.left = `${x}px`;
    el.style.top = "-70px";
    wrapper.appendChild(el);

    // Force a style flush before changing `top` again, so the browser
    // actually animates from -70px instead of jumping straight to the end
    // position — the non-rAF equivalent of the usual double-rAF trick.
    void el.offsetHeight;
    el.style.transition = `top ${FALL_DURATION_MS}ms linear`;
    el.style.top = `${containerEl.clientHeight + 20}px`;

    el.addEventListener("click", () => handleTap(emoji, el));
    el.addEventListener("transitionend", () => {
      if (resolved) {
        el.remove();
        return;
      }
      const wasTarget = emoji === target;
      el.remove();
      if (wasTarget) lose(); // the target fell through uncaught
    });
  }

  function handleTap(emoji, el) {
    if (resolved) return;
    el.remove();
    if (emoji === target) {
      win();
    } else {
      lose();
    }
  }

  function clearFallingItems() {
    wrapper.querySelectorAll(".falling-item").forEach((el) => el.remove());
  }

  function win() {
    resolved = true;
    clearInterval(spawnTimer);
    clearFallingItems();
    setTimeout(onWin, 200);
  }

  function lose() {
    if (resolved) return;
    resolved = true;
    clearInterval(spawnTimer);
    clearFallingItems();
    // Real gift play gets a retry overlay — a demo caller passes onLose
    // instead, skipping straight to the pitch after this one try.
    if (onLose) {
      setTimeout(onLose, 200);
      return;
    }
    wrapper.querySelector(".cooking-gameover-overlay").classList.remove("hidden");
  }

  startRound();
}
