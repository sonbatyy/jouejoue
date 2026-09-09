(function () {
  const { token, templateSlug, question, recipientName } = window.__PLAY__;
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
    window.GameLib.confetti();
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

  const init = GAME_REGISTRY[templateSlug];
  if (init) {
    init({ containerEl, onWin });
  } else {
    containerEl.innerHTML = '<p style="padding: 40px; text-align: center;">This game type isn\'t supported yet.</p>';
  }
})();
