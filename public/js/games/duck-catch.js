// Ported from juju-cake-game's duck minigame: one fast duck, click/tap
// directly catches it (no drag needed). Three rounds now, each faster than
// the last, before it calls onWin() — the same progressive-difficulty
// pattern as cake-catch.
const DUCK_CATCH_LEVELS = {
  easy: { moveIntervalMs: 1800 },
  medium: { moveIntervalMs: 1200 },
  hard: { moveIntervalMs: 700 },
};
const DUCK_TOTAL_ROUNDS = 3;
const DUCK_ROUND_SPEED_MULTIPLIERS = [1, 0.75, 0.55];

function initDuckCatch({ containerEl, onWin, level }) {
  const { randomPosition, placeAt } = window.GameLib;
  const { moveIntervalMs } = DUCK_CATCH_LEVELS[level] || DUCK_CATCH_LEVELS.medium;
  const duck = containerEl.querySelector(".critter.duck");
  const instructions = containerEl.querySelector(".play-instructions");

  let caught = false;
  let moveTimer = null;
  let round = 1;

  function updateInstructions() {
    if (!instructions) return;
    instructions.textContent =
      round < DUCK_TOTAL_ROUNDS
        ? `Round ${round} of ${DUCK_TOTAL_ROUNDS}: catch the duck.`
        : `Final round: one more catch to win.`;
  }

  function runAway() {
    if (caught) return;
    const { x, y } = randomPosition(containerEl, duck);
    placeAt(duck, x, y);
  }

  function startRound() {
    caught = false;
    duck.style.opacity = "1";
    const { x, y } = randomPosition(containerEl, duck);
    placeAt(duck, x, y);
    updateInstructions();

    const speed = moveIntervalMs * (DUCK_ROUND_SPEED_MULTIPLIERS[round - 1] || DUCK_ROUND_SPEED_MULTIPLIERS[DUCK_ROUND_SPEED_MULTIPLIERS.length - 1]);
    clearInterval(moveTimer);
    moveTimer = setInterval(runAway, speed);
  }

  function catchDuck() {
    if (caught) return;
    caught = true;
    clearInterval(moveTimer);
    duck.style.opacity = "0";

    if (round < DUCK_TOTAL_ROUNDS) {
      round += 1;
      setTimeout(startRound, 400);
    } else {
      setTimeout(onWin, 200);
    }
  }

  duck.addEventListener("click", catchDuck);
  window.addEventListener("resize", () => {
    if (!caught) runAway();
  });

  startRound();
}
