// Cake that jumps around the screen; drag it into the mouse's mouth to
// catch it. Three rounds, no decoys, no wrong guess, so there's no
// "game over" state either — every round ends in a catch, just a
// progressively faster one, until the third catch wins it.
const CAKE_CATCH_LEVELS = {
  easy: { moveIntervalMs: 1800 },
  medium: { moveIntervalMs: 1200 },
  hard: { moveIntervalMs: 700 },
};
const CAKE_TOTAL_ROUNDS = 3;
// Round 1 at the level's own base pace, then each round dodges faster than
// the last — difficulty compounds within a single playthrough, not just
// between levels.
const CAKE_ROUND_SPEED_MULTIPLIERS = [1, 0.75, 0.55];

function initCakeCatch({ containerEl, onWin, level }) {
  const { randomPosition, placeAt, getPointer } = window.GameLib;
  const { moveIntervalMs } = CAKE_CATCH_LEVELS[level] || CAKE_CATCH_LEVELS.medium;

  const cake = containerEl.querySelector(".critter.cake");
  const mouth = containerEl.querySelector("#play-mouth");
  const instructions = containerEl.querySelector(".play-instructions");

  let grabbed = false;
  let resolved = false;
  let moveTimer = null;
  let pointerOffset = { x: 0, y: 0 };
  let round = 1;

  function updateInstructions() {
    if (!instructions) return;
    instructions.textContent =
      round < CAKE_TOTAL_ROUNDS
        ? `Round ${round} of ${CAKE_TOTAL_ROUNDS}: catch it, feed the mouse.`
        : `Final round: one more catch to win.`;
  }

  function runAway() {
    if (grabbed || resolved) return;
    const { x, y } = randomPosition(containerEl, cake);
    placeAt(cake, x, y);
  }

  function startRound() {
    resolved = false;
    grabbed = false;
    cake.classList.remove("grabbed");
    cake.style.opacity = "1";
    const { x, y } = randomPosition(containerEl, cake);
    placeAt(cake, x, y);
    updateInstructions();

    const speed = moveIntervalMs * (CAKE_ROUND_SPEED_MULTIPLIERS[round - 1] || CAKE_ROUND_SPEED_MULTIPLIERS[CAKE_ROUND_SPEED_MULTIPLIERS.length - 1]);
    clearInterval(moveTimer);
    moveTimer = setInterval(runAway, speed);
  }

  function onGrabStart(e) {
    if (resolved) return;
    grabbed = true;
    cake.classList.add("grabbed");
    const rect = cake.getBoundingClientRect();
    const p = getPointer(e);
    pointerOffset = { x: p.x - rect.left, y: p.y - rect.top };
    e.preventDefault();
  }

  function onMove(e) {
    if (!grabbed) return;
    const p = getPointer(e);
    placeAt(cake, p.x - pointerOffset.x, p.y - pointerOffset.y);
    if (isOverMouth()) resolveWin();
  }

  function isOverMouth() {
    const cakeRect = cake.getBoundingClientRect();
    const mouthRect = mouth.getBoundingClientRect();
    const cx = cakeRect.left + cakeRect.width / 2;
    const cy = cakeRect.top + cakeRect.height / 2;
    return cx >= mouthRect.left && cx <= mouthRect.right && cy >= mouthRect.top && cy <= mouthRect.bottom;
  }

  function onRelease() {
    if (!grabbed || resolved) return;
    grabbed = false;
    cake.classList.remove("grabbed");
  }

  function resolveWin() {
    resolved = true;
    clearInterval(moveTimer);
    grabbed = false;
    cake.classList.remove("grabbed");

    const mouthRect = mouth.getBoundingClientRect();
    const areaRect = containerEl.getBoundingClientRect();
    placeAt(
      cake,
      mouthRect.left - areaRect.left - cake.offsetWidth / 2 + mouthRect.width / 2,
      mouthRect.top - areaRect.top - cake.offsetHeight / 2 + mouthRect.height / 2
    );
    cake.style.opacity = "0";

    if (round < CAKE_TOTAL_ROUNDS) {
      round += 1;
      setTimeout(startRound, 500);
    } else {
      setTimeout(onWin, 300);
    }
  }

  cake.addEventListener("mousedown", onGrabStart);
  cake.addEventListener("touchstart", onGrabStart, { passive: false });
  window.addEventListener("mousemove", onMove);
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("mouseup", onRelease);
  window.addEventListener("touchend", onRelease);
  window.addEventListener("resize", () => {
    if (!resolved) runAway();
  });

  startRound();
}
