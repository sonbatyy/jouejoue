// Ported from juju-cake-game's duck minigame: one fast duck, click/tap
// directly catches it (no drag needed) and calls onWin().
const DUCK_CATCH_LEVELS = {
  easy: { moveIntervalMs: 1800 },
  medium: { moveIntervalMs: 1200 },
  hard: { moveIntervalMs: 700 },
};
function initDuckCatch({ containerEl, onWin, level }) {
  const { randomPosition, placeAt } = window.GameLib;
  const { moveIntervalMs } = DUCK_CATCH_LEVELS[level] || DUCK_CATCH_LEVELS.medium;
  const duck = containerEl.querySelector(".critter.duck");

  let caught = false;
  let moveTimer = null;

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
    clearInterval(moveTimer);
    moveTimer = setInterval(runAway, moveIntervalMs);
  }

  function catchDuck() {
    if (caught) return;
    caught = true;
    clearInterval(moveTimer);
    duck.style.opacity = "0";
    setTimeout(onWin, 200);
  }

  duck.addEventListener("click", catchDuck);
  window.addEventListener("resize", () => {
    if (!caught) runAway();
  });

  startRound();
}
