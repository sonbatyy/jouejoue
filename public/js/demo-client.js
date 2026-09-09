(function () {
  const { templateSlug, templateId, templateName, templatePrice } = window.__PLAY__;
  const containerEl = document.querySelector(".play-shell");

  // One demo, one try, whichever way it goes — no retry loop, no switching
  // to a different game afterward. Win or lose both land here: the whole
  // point of a demo is to feel the game for a few seconds, then decide.
  function showPayPrompt(outcome) {
    if (outcome === "won") window.GameLib.confettiRain();
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    const heading = outcome === "lost" ? "That's the demo" : "Nailed it!";
    const body = outcome === "lost"
      ? "Missed it this time, but that's exactly what whoever you send this to will play. They get unlimited retries, not just one shot."
      : "That's what a real link plays like. A real one asks your own question, stays live a full month, and emails you the moment they answer.";
    overlay.innerHTML = `
      <div class="modal-box">
        <h2>${heading}</h2>
        <p>${body}</p>
        <a href="/payment/${templateId}" class="btn btn-primary wash btn-fun" style="width: 100%; display: flex; margin-top: 4px;">Make this for real · ${templatePrice} <span class="btn-fun__icon">▶</span></a>
        <a href="/" class="btn btn-secondary" style="width: 100%; display: block; margin-top: 8px;">Maybe later</a>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  const GAME_REGISTRY = {
    "cake-catch": window.initCakeCatch,
    "duck-catch": window.initDuckCatch,
    "flappy-bird": window.initFlappyBird,
    cooking: window.initCooking,
  };

  const init = GAME_REGISTRY[templateSlug];
  if (init) {
    init({
      containerEl,
      onWin: () => showPayPrompt("won"),
      onLose: () => showPayPrompt("lost"),
    });
  }
})();
