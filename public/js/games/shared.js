// Shared helpers for all catch-minigames, adapted from juju-cake-game's
// game.js (randomPosition/placeAt/getPointer), generalized so any game
// module just needs { containerEl, question, onWin }.
window.GameLib = (function () {
  function randomPosition(area, el) {
    const size = el.offsetWidth || 64;
    const maxX = area.clientWidth - size;
    const maxY = area.clientHeight - size;
    return {
      x: Math.max(0, Math.random() * maxX),
      y: Math.max(0, Math.random() * maxY),
    };
  }

  function placeAt(el, x, y) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  function getPointer(e) {
    if (e.touches && e.touches.length) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  const CONFETTI_COLORS = ["#cf5d3b", "#8a5a3c", "#f7ded2", "#ecdcc9", "#332a22"];
  const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // A small celebratory burst — used on every "you won" moment (real play
  // and demo alike), and on tapping a floating emoji on the games page.
  // Plain divs animated with CSS, no canvas/library: cheap enough to spawn
  // a few dozen and let them clean themselves up via animationend.
  function confetti({ x, y, count = 28 } = {}) {
    if (prefersReducedMotion()) return;
    const originX = x ?? window.innerWidth / 2;
    const originY = y ?? window.innerHeight / 3;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      const angle = Math.random() * Math.PI * 2;
      const distance = 60 + Math.random() * 140;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance * 0.4 + 220 + Math.random() * 120;
      piece.style.left = `${originX}px`;
      piece.style.top = `${originY}px`;
      piece.style.setProperty("--dx", `${dx}px`);
      piece.style.setProperty("--dy", `${dy}px`);
      piece.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
      piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      piece.style.animationDuration = `${1.1 + Math.random() * 0.7}s`;
      document.body.appendChild(piece);
      piece.addEventListener("animationend", () => piece.remove());
    }
  }

  // A longer, gentler rain of confetti falling from the top of the screen
  // to the bottom, spawned continuously for `duration` — the "played in the
  // background for a while" version, for the actual "you won" moment,
  // distinct from the instant burst() used for a quick tap-triggered pop.
  function confettiRain({ duration = 3400, intervalMs = 110 } = {}) {
    if (prefersReducedMotion()) return;
    const endAt = Date.now() + duration;
    function spawnOne() {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      const startX = Math.random() * window.innerWidth;
      const drift = Math.random() * 160 - 80;
      piece.style.left = `${startX}px`;
      piece.style.top = "-20px";
      piece.style.setProperty("--dx", `${drift}px`);
      piece.style.setProperty("--dy", `${window.innerHeight + 60}px`);
      piece.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
      piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      piece.style.animationDuration = `${2.6 + Math.random() * 1.8}s`;
      piece.style.animationTimingFunction = "linear";
      document.body.appendChild(piece);
      piece.addEventListener("animationend", () => piece.remove());
    }
    for (let i = 0; i < 6; i++) spawnOne(); // an immediate first handful, not a slow trickle-in
    const timer = setInterval(() => {
      if (Date.now() >= endAt) {
        clearInterval(timer);
        return;
      }
      spawnOne();
    }, intervalMs);
  }

  // Builds the "you caught it" modal. The question text and recipient name
  // are set via textContent (never innerHTML) since they're untrusted
  // buyer-supplied input rendered to a different visitor (the recipient) —
  // this avoids any HTML/script injection through a crafted value.
  function createSuccessModal({ question, name, onSubmit }) {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="modal-box">
        <h2 class="modal-heading"><span aria-hidden="true">🎉</span> Bravo <span class="modal-heading__name wash-text"></span></h2>
        <p class="modal-question"></p>
        <form class="answer-form">
          <input type="text" placeholder="Type your answer..." autocomplete="off" required />
          <button type="submit" class="btn btn-primary">Submit</button>
        </form>
        <div class="modal-thanks hidden">
          <p>Thanks. They've been notified.</p>
        </div>
      </div>
    `;
    overlay.querySelector(".modal-heading__name").textContent = name || "";
    overlay.querySelector(".modal-question").textContent = question;
    document.body.appendChild(overlay);

    const form = overlay.querySelector(".answer-form");
    const input = form.querySelector("input");
    const thanksEl = overlay.querySelector(".modal-thanks");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const answer = input.value.trim();
      if (!answer) {
        input.focus();
        return;
      }
      const submitBtn = form.querySelector("button");
      submitBtn.disabled = true;

      onSubmit(answer, {
        onSuccess() {
          form.classList.add("hidden");
          thanksEl.classList.remove("hidden");
        },
        onError() {
          submitBtn.disabled = false;
          alert("Could not save your answer, please try again.");
        },
      });
    });

    input.focus();
    return overlay;
  }

  return { randomPosition, placeAt, getPointer, createSuccessModal, confetti, confettiRain };
})();
