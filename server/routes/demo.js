const express = require("express");
const db = require("../db");
const { resolveCurrency, withLocalizedPrice } = require("../lib/pricing");

const router = express.Router();

const DEMO_QUESTION = "What should we try next?";
const VALID_SLUGS = ["cake-catch", "duck-catch", "flappy-bird", "cooking"];

// A one-line teaser per game for the big graphic picker cards — separate
// from game_templates.description (that copy is written for the catalog,
// where the buyer already knows what they're buying; this is written to
// sell someone who's still deciding whether to bother trying at all).
const DEMO_TEASERS = {
  "cake-catch": "Drag the cake into the mouse before it runs off.",
  "duck-catch": "One quick tap. Catch the duck, that's it.",
  "flappy-bird": "Tap to flap. Thread the gaps, reach 20.",
  cooking: "Watch the sky. Catch the right one, don't blink.",
};
const DEMO_ICONS = {
  "cake-catch": "🍰",
  "duck-catch": "🦆",
  "flappy-bird": "🐦",
  cooking: "🍓",
};

// Choose ONE game to try — no slug in the URL yet. A demo is meant to be a
// single, quick taste of what buying gets someone, not an arcade you can
// loop through picking a different game every time you finish one.
router.get("/demo", async (req, res) => {
  const placeholders = VALID_SLUGS.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM game_templates WHERE slug IN (${placeholders}) AND is_custom_tier = 0`)
    .all(...VALID_SLUGS);
  const bySlug = Object.fromEntries(rows.map((t) => [t.slug, t]));
  const currency = await resolveCurrency(req);
  const games = VALID_SLUGS.filter((slug) => bySlug[slug]).map((slug) => ({
    ...withLocalizedPrice(bySlug[slug], currency),
    icon: DEMO_ICONS[slug],
    teaser: DEMO_TEASERS[slug],
  }));
  res.render("demo-picker", { games });
});

// Play exactly one demo game. Win or lose, the client shows a "make this
// for real?" prompt straight into checkout for this template — no switcher
// back to try a different demo.
router.get("/demo/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!VALID_SLUGS.includes(slug)) return res.redirect("/demo");
  const template = db.prepare("SELECT * FROM game_templates WHERE slug = ? AND is_custom_tier = 0").get(slug);
  if (!template) return res.redirect("/demo");
  const currency = await resolveCurrency(req);
  res.render("demo-play", {
    playData: {
      templateSlug: slug,
      templateId: template.id,
      templateName: template.name,
      templatePrice: withLocalizedPrice(template, currency).priceDisplay,
      question: DEMO_QUESTION,
    },
  });
});

module.exports = router;
