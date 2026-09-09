// One emoji per bank game, shared between the demo picker and the games
// catalog so both pages show the exact same icon per game rather than two
// maps quietly drifting apart.
const GAME_ICONS = {
  "cake-catch": "🍰",
  "duck-catch": "🦆",
  "flappy-bird": "🐦",
  cooking: "🍓",
};

// Shown on the "something else in mind?" custom-request card, which has no
// slug of its own to look up.
const CUSTOM_ICON = "✨";

module.exports = { GAME_ICONS, CUSTOM_ICON };
