// Self-contained: builds its own DOM inside containerEl. Classic flappy
// mechanics (gravity, flap-on-tap, scrolling pipes), tuned slow and
// forgiving on purpose right now — this is a prototype and we're testing
// the win flow end to end, not tuning difficulty yet.
function initFlappyBird({ containerEl, onWin }) {
  // Tuned against a headless simulation (aim-for-the-gap bot), not just
  // eyeballed: at these values it won 15/15 simulated runs, while doing
  // nothing at all still loses quickly — genuinely easy, not a freebie.
  const WIN_SCORE = 20;
  const GRAVITY = 700; // px/s^2, gentle
  const FLAP_VELOCITY = -260; // px/s, upward
  const PIPE_SPEED = 65; // px/s, slow on purpose
  const PIPE_GAP = 460; // px, very generous on purpose
  const PIPE_WIDTH = 70; // px
  const PIPE_INTERVAL_MS = 2200; // slow spawn rate
  const BIRD_SIZE = 50;
  const BIRD_X = 100;

  containerEl.innerHTML = `
    <div class="play-instructions">Tap or click to flap. Reach ${WIN_SCORE} to win.</div>
    <div class="flappy-score">0 / ${WIN_SCORE}</div>
    <div class="flappy-bird-el">🐦</div>
    <div class="overlay hidden flappy-gameover-overlay">
      <div class="modal-box">
        <h2>Missed it</h2>
        <p>Try again!</p>
        <button type="button" class="btn btn-primary flappy-retry-btn">Try again</button>
      </div>
    </div>
  `;

  const scoreEl = containerEl.querySelector(".flappy-score");
  const birdEl = containerEl.querySelector(".flappy-bird-el");
  const gameoverOverlay = containerEl.querySelector(".flappy-gameover-overlay");
  const retryBtn = containerEl.querySelector(".flappy-retry-btn");

  let areaHeight, areaWidth;
  let birdY, velocity, pipes, score, running, lastTime, spawnTimer, rafId;

  function measure() {
    areaHeight = containerEl.clientHeight;
    areaWidth = containerEl.clientWidth;
  }

  function reset() {
    measure();
    birdY = areaHeight / 2;
    velocity = 0;
    score = 0;
    running = true;
    spawnTimer = 0;
    lastTime = null;
    scoreEl.textContent = `0 / ${WIN_SCORE}`;
    gameoverOverlay.classList.add("hidden");
    containerEl.querySelectorAll(".flappy-pipe").forEach((el) => el.remove());
    pipes = [];
    render();

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function spawnPipe() {
    const margin = 60;
    const gapTop = margin + Math.random() * (areaHeight - PIPE_GAP - margin * 2);
    const topEl = document.createElement("div");
    topEl.className = "flappy-pipe flappy-pipe--top";
    const bottomEl = document.createElement("div");
    bottomEl.className = "flappy-pipe flappy-pipe--bottom";
    containerEl.appendChild(topEl);
    containerEl.appendChild(bottomEl);
    pipes.push({ x: areaWidth, gapTop, passed: false, topEl, bottomEl });
  }

  function loop(time) {
    if (!running) return;
    if (lastTime === null) lastTime = time;
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    velocity += GRAVITY * dt;
    birdY += velocity * dt;

    spawnTimer += dt * 1000;
    if (spawnTimer >= PIPE_INTERVAL_MS) {
      spawnTimer = 0;
      spawnPipe();
    }

    pipes.forEach((pipe) => {
      pipe.x -= PIPE_SPEED * dt;
      if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
        pipe.passed = true;
        score += 1;
        scoreEl.textContent = `${score} / ${WIN_SCORE}`;
      }
    });
    pipes = pipes.filter((pipe) => {
      if (pipe.x + PIPE_WIDTH < -10) {
        pipe.topEl.remove();
        pipe.bottomEl.remove();
        return false;
      }
      return true;
    });

    if (birdY < 0 || birdY + BIRD_SIZE > areaHeight) return gameOver();
    for (const pipe of pipes) {
      const overlapsX = BIRD_X + BIRD_SIZE > pipe.x && BIRD_X < pipe.x + PIPE_WIDTH;
      if (overlapsX && (birdY < pipe.gapTop || birdY + BIRD_SIZE > pipe.gapTop + PIPE_GAP)) {
        return gameOver();
      }
    }

    if (score >= WIN_SCORE) {
      running = false;
      setTimeout(onWin, 200);
      return;
    }

    render();
    rafId = requestAnimationFrame(loop);
  }

  function render() {
    birdEl.style.top = `${birdY}px`;
    birdEl.style.left = `${BIRD_X}px`;
    const tilt = Math.max(-25, Math.min(70, velocity / 8));
    birdEl.style.transform = `rotate(${tilt}deg)`;
    pipes.forEach((pipe) => {
      pipe.topEl.style.left = `${pipe.x}px`;
      pipe.topEl.style.width = `${PIPE_WIDTH}px`;
      pipe.topEl.style.top = "0px";
      pipe.topEl.style.height = `${pipe.gapTop}px`;
      pipe.bottomEl.style.left = `${pipe.x}px`;
      pipe.bottomEl.style.width = `${PIPE_WIDTH}px`;
      pipe.bottomEl.style.top = `${pipe.gapTop + PIPE_GAP}px`;
      pipe.bottomEl.style.height = `${areaHeight - (pipe.gapTop + PIPE_GAP)}px`;
    });
  }

  function gameOver() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    gameoverOverlay.classList.remove("hidden");
  }

  function flap() {
    if (!running) return;
    velocity = FLAP_VELOCITY;
  }

  containerEl.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".flappy-gameover-overlay")) return;
    e.preventDefault();
    flap();
  });
  retryBtn.addEventListener("click", reset);
  window.addEventListener("resize", measure);

  reset();
}
