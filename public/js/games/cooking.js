// Appends its own wrapper inside containerEl rather than overwriting
// containerEl.innerHTML — see flappy-bird.js for why: containerEl is the
// whole .play-shell, and on the demo page that also holds the "Back to
// JoueJoue" button and the game switcher as siblings.
//
// One target fruit is picked for the whole round. Fruits and vegetables
// fall from the top the entire time; catch the required number of the
// target before the clock runs out to win. Tapping the wrong one just does
// nothing (no penalty), and the target falling through uncaught doesn't
// end the game either, the countdown is the only real threat now, not one
// unlucky miss. Falling is driven by a CSS transition (not
// requestAnimationFrame), so it keeps animating correctly even in
// contexts where rAF gets throttled.
const COOKING_LEVELS = {
  easy: { targetCount: 3, timeLimitSec: 25, fallDurationMs: 4500, spawnIntervalMs: 1200, targetChance: 0.45 },
  medium: { targetCount: 5, timeLimitSec: 20, fallDurationMs: 3600, spawnIntervalMs: 950, targetChance: 0.4 },
  hard: { targetCount: 8, timeLimitSec: 18, fallDurationMs: 2600, spawnIntervalMs: 700, targetChance: 0.35 },
};
function initCooking({ containerEl, onWin, onLose, level }) {
  const { targetCount, timeLimitSec, fallDurationMs, spawnIntervalMs, targetChance } =
    COOKING_LEVELS[level] || COOKING_LEVELS.medium;
  const ITEMS = ["🍎", "🍌", "🍇", "🍊", "🍓", "🥕", "🥦", "🍆"];
  const FALL_DURATION_MS = fallDurationMs;
  const SPAWN_INTERVAL_MS = spawnIntervalMs;
  const TARGET_CHANCE = targetChance; // how often a spawn is the target vs a decoy

  const wrapper = document.createElement("div");
  containerEl.appendChild(wrapper);

  let target, spawnTimer, countdownTimer, resolved, caughtCount, secondsLeft;

  function pickTarget() {
    target = ITEMS[Math.floor(Math.random() * ITEMS.length)];
  }

  function render() {
    wrapper.innerHTML = `
      <div class="play-instructions">Catch ${targetCount} of the right one before time runs out.</div>
      <div class="cooking-target-badge">
        <span class="cooking-target-emoji">${target}</span>
        <span class="cooking-target-count">${caughtCount} / ${targetCount}</span>
        <span class="cooking-target-timer">${secondsLeft}s</span>
      </div>
      <div class="overlay hidden cooking-gameover-overlay">
        <div class="modal-box">
          <h2>Out of time</h2>
          <p>Didn't catch enough of them. Try again!</p>
          <button type="button" class="btn btn-primary cooking-retry-btn">Try again</button>
        </div>
      </div>
    `;
    wrapper.querySelector(".cooking-retry-btn").addEventListener("click", startRound);
  }

  function updateBadge() {
    const countEl = wrapper.querySelector(".cooking-target-count");
    const timerEl = wrapper.querySelector(".cooking-target-timer");
    if (countEl) countEl.textContent = `${caughtCount} / ${targetCount}`;
    if (timerEl) timerEl.textContent = `${secondsLeft}s`;
  }

  function startRound() {
    resolved = false;
    caughtCount = 0;
    secondsLeft = timeLimitSec;
    pickTarget();
    render();

    clearInterval(spawnTimer);
    spawnTimer = setInterval(spawnItem, SPAWN_INTERVAL_MS);
    spawnItem();

    clearInterval(countdownTimer);
    countdownTimer = setInterval(tickClock, 1000);
  }

  function tickClock() {
    if (resolved) return;
    secondsLeft -= 1;
    updateBadge();
    if (secondsLeft <= 0) lose();
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
    el.addEventListener("transitionend", () => el.remove());
  }

  function handleTap(emoji, el) {
    if (resolved) return;
    el.remove();
    if (emoji !== target) return; // wrong one: no penalty, just doesn't count
    caughtCount += 1;
    updateBadge();
    if (caughtCount >= targetCount) win();
  }

  function clearFallingItems() {
    wrapper.querySelectorAll(".falling-item").forEach((el) => el.remove());
  }

  function win() {
    resolved = true;
    clearInterval(spawnTimer);
    clearInterval(countdownTimer);
    clearFallingItems();
    setTimeout(onWin, 200);
  }

  function lose() {
    if (resolved) return;
    resolved = true;
    clearInterval(spawnTimer);
    clearInterval(countdownTimer);
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
