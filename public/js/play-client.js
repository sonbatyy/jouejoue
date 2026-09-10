(function () {
  const { token, templateSlug, question, recipientName, senderName } = window.__PLAY__;
  const containerEl = document.querySelector(".play-shell");

  function submitAnswer(answer, { onSuccess, onError }) {
    fetch(`/api/play/${token}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("request failed");
        onSuccess();
      })
      .catch(onError);
  }

  function onWin() {
    window.GameLib.confettiRain();
    window.GameLib.createSuccessModal({ question, name: recipientName, onSubmit: submitAnswer });
  }

  // Every game module shares the same { containerEl, onWin } contract.
  // cake-catch/duck-catch expect containerEl to already hold their markup
  // (rendered by the EJS template); the newer games build their own DOM
  // inside containerEl instead, so adding one more game here never needs a
  // matching template branch.
  const GAME_REGISTRY = {
    "cake-catch": window.initCakeCatch,
    "duck-catch": window.initDuckCatch,
    "flappy-bird": window.initFlappyBird,
    cooking: window.initCooking,
  };

  function startGame() {
    const init = GAME_REGISTRY[templateSlug];
    if (init) {
      init({ containerEl, onWin });
    } else {
      containerEl.innerHTML = '<p style="padding: 40px; text-align: center;">This game type isn\'t supported yet.</p>';
    }
  }

  // Older instances (created before sender name/note existed) have neither
  // — skip straight to the game rather than showing a blank "sent this to
  // you" card with nobody's name on it.
  const introOverlay = document.getElementById("play-intro-overlay");
  if (senderName && introOverlay) {
    introOverlay.classList.remove("hidden");
    document.getElementById("play-intro-start").addEventListener("click", () => {
      introOverlay.classList.add("hidden");
      startGame();
    });
  } else {
    startGame();
  }
})();
