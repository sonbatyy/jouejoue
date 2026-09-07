// Appends its own wrapper inside containerEl rather than overwriting
// containerEl.innerHTML — containerEl is the whole .play-shell, which on
// the demo page also holds the "Back to JoueJoue" button and the game
// switcher as siblings; wiping the container's innerHTML was deleting
// both. The wrapper has no positioning of its own, so absolutely-positioned
// children inside it still resolve against .play-shell exactly as before.
function initFlappyBird({ containerEl, onWin }) {
  // Tuned against a headless simulation (aim-for-the-gap bot): 30/30 win
  // rate at this pace — pipes move fast and are spaced well apart (~400px
  // between them), but the gap itself is still a real, reachable target.
  const WIN_SCORE = 20;
  const GRAVITY = 900; // px/s^2
  const FLAP_VELOCITY = -330; // px/s, upward
  const PIPE_SPEED = 220; // px/s
  const PIPE_GAP = 380; // px
  const PIPE_WIDTH = 70; // px
  const PIPE_INTERVAL_MS = 1800;
  const BIRD_SIZE = 50;
  const BIRD_X = 100;

  const wrapper = document.createElement("div");
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
  retryBtn.addEventListener("click", reset);
  window.addEventListener("resize", measure);

  reset();
}
