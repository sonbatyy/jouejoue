// Appends its own wrapper inside containerEl rather than overwriting
// containerEl.innerHTML — containerEl is the whole .play-shell, which on
// the demo page also holds the "Back to JoueJoue" button and the game
// switcher as siblings; wiping the container's innerHTML was deleting
// both. The wrapper has no positioning of its own, so absolutely-positioned
// children inside it still resolve against .play-shell exactly as before.
// "medium" is the original pace, tuned against a headless simulation
// (aim-for-the-gap bot) to a 30/30 win rate: pipes move fast and are spaced
// well apart (~400px), but the gap itself is still a real, reachable
// target. easy/hard scale the win score, pipe gap, and pipe speed off that
// same baseline rather than being separately tuned from scratch.
const FLAPPY_LEVELS = {
  easy: { winScore: 15, pipeGap: 460, pipeSpeed: 180 },
  medium: { winScore: 20, pipeGap: 380, pipeSpeed: 220 },
  hard: { winScore: 25, pipeGap: 310, pipeSpeed: 260 },
};
function initFlappyBird({ containerEl, onWin, onLose, level }) {
  const { winScore, pipeGap, pipeSpeed } = FLAPPY_LEVELS[level] || FLAPPY_LEVELS.medium;
  const WIN_SCORE = winScore;
  const GRAVITY = 900; // px/s^2
  const FLAP_VELOCITY = -330; // px/s, upward
  const PIPE_SPEED = pipeSpeed; // px/s
  const PIPE_GAP = pipeGap; // px
  const PIPE_WIDTH = 70; // px
  const PIPE_INTERVAL_MS = 1800;
  const BIRD_SIZE = 50;
  const BIRD_X = 100;

  const wrapper = document.createElement("div");
  // Explicit size matters here: with no CSS class, a bare wrapper div only
  // occupies space where its own in-flow content sits — since every child
  // inside it (bird, pipes, score chip) is absolutely positioned, the
  // wrapper itself would otherwise collapse to ~0 height. Taps landing on
  // empty background then hit containerEl behind it instead of wrapper,
  // which is where the flap listener below actually lives. Filling the
  // whole area makes "tap anywhere" mean anywhere, not just on the bird.
  wrapper.style.position = "absolute";
  wrapper.style.inset = "0";
  containerEl.appendChild(wrapper);
  wrapper.innerHTML = `
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

  const scoreEl = wrapper.querySelector(".flappy-score");
  const birdEl = wrapper.querySelector(".flappy-bird-el");
  const gameoverOverlay = wrapper.querySelector(".flappy-gameover-overlay");
  const retryBtn = wrapper.querySelector(".flappy-retry-btn");

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
    wrapper.querySelectorAll(".flappy-pipe").forEach((el) => el.remove());
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
    wrapper.appendChild(topEl);
    wrapper.appendChild(bottomEl);
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
    // A real gift recipient gets unlimited retries — losing shouldn't end
    // something someone already paid for. A demo caller passes onLose to
    // skip the retry overlay entirely: one try, then straight to the pitch.
    if (onLose) {
      setTimeout(onLose, 200);
      return;
    }
    gameoverOverlay.classList.remove("hidden");
  }

  function flap() {
    if (!running) return;
    velocity = FLAP_VELOCITY;
  }

  wrapper.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".flappy-gameover-overlay")) return;
    e.preventDefault();
    flap();
  });
  // iOS Safari's double-tap-to-zoom gesture is detected from touchend timing
  // and isn't reliably suppressed by touch-action CSS alone (a long-standing
  // WebKit quirk) — a quick double-tap here should just flap twice, not zoom
  // the page. preventDefault on touchend (as a non-passive listener) kills
  // the zoom without affecting the flap, which already fires per tap above.
  wrapper.addEventListener(
    "touchend",
    (e) => {
      if (e.target.closest(".flappy-gameover-overlay")) return;
      e.preventDefault();
    },
    { passive: false }
  );
  retryBtn.addEventListener("click", reset);
  window.addEventListener("resize", measure);

  reset();
}
