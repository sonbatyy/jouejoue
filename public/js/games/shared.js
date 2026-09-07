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

  // Builds the "you caught it" modal. The question text and recipient name
  // are set via textContent (never innerHTML) since they're untrusted
  // buyer-supplied input rendered to a different visitor (the recipient) —
  // this avoids any HTML/script injection through a crafted value.
  function createSuccessModal({ question, name, onSubmit }) {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="modal-box">
        <h2 class="modal-heading"></h2>
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
    overlay.querySelector(".modal-heading").textContent = name ? `Bravo ${name}` : "Bravo";
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

  return { randomPosition, placeAt, getPointer, createSuccessModal };
})();
