(function () {
  const { templateSlug } = window.__PLAY__;
  const containerEl = document.querySelector(".play-shell");

  function showDemoComplete() {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="modal-box">
        <h2>That's the demo</h2>
        <p>A real game sends this to whoever you're asking, then emails you the moment they answer.</p>
        <a href="/#catalog" class="btn btn-primary" style="width: 100%; display: block; margin-top: 8px;">Browse games</a>
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
  if (init) init({ containerEl, onWin: showDemoComplete });
})();
