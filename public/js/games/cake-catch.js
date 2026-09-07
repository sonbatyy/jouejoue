// Single cake that jumps around the screen; drag it into the mouse's mouth
// to win. No decoys, no wrong guess, so there's no "game over" state.
// Speed is intentionally slow right now: this is a prototype and we're
// still testing the win flow end to end, not tuning difficulty yet.
function initCakeCatch({ containerEl, onWin }) {
  const { randomPosition, placeAt, getPointer } = window.GameLib;

  const cake = containerEl.querySelector(".critter.cake");
  const mouth = containerEl.querySelector("#play-mouth");

  let grabbed = false;
  let resolved = false;
  let moveTimer = null;
  let pointerOffset = { x: 0, y: 0 };

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

    clearInterval(moveTimer);
    moveTimer = setInterval(runAway, 1200);
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

    setTimeout(onWin, 300);
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
