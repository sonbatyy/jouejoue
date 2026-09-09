const express = require("express");
const db = require("../db");
const { resolveCurrency, withLocalizedPrice, formatEgp, formatConverted } = require("../lib/pricing");
const { GAME_ICONS } = require("../lib/gameIcons");

const router = express.Router();

async function getCatalogData(req) {
  const currency = await resolveCurrency(req);
  const templates = db.prepare("SELECT * FROM game_templates ORDER BY is_custom_tier ASC, id ASC").all();
  const catalogGames = templates
    .filter((t) => !t.is_custom_tier)
    .map((t) => ({ ...withLocalizedPrice(t, currency), icon: GAME_ICONS[t.slug] }));
  const customTier = withLocalizedPrice(templates.find((t) => t.is_custom_tier), currency);

  const egpValues = catalogGames.map((g) => g.price_egp);
  const usdCentValues = catalogGames.map((g) => g.price_usd_cents);
  const minEgp = Math.min(...egpValues);
  const maxEgp = Math.max(...egpValues);
  const minCents = Math.min(...usdCentValues);
  const maxCents = Math.max(...usdCentValues);

  const bankGameRange = {
    display:
      currency === "EGP"
        ? minEgp === maxEgp
          ? formatEgp(minEgp)
          : `${minEgp} to ${formatEgp(maxEgp)}`
        : minCents === maxCents
        ? formatConverted(minCents, currency)
        : `${formatConverted(minCents, currency)} to ${formatConverted(maxCents, currency)}`,
  };

  return { catalogGames, customTier, bankGameRange, currency };
}

// Home: one job — get someone to either try a demo or go look at the games.
// Everything else (how it works, pricing, the full catalog) used to live
// crammed onto this same page; it now gets its own page, so a visitor is
// only ever asked to think about one thing at a time.
router.get("/", async (req, res) => {
  const { bankGameRange } = await getCatalogData(req);
  res.render("landing", { bankGameRange });
});

router.get("/how-it-works", async (req, res) => {
  res.render("how-it-works");
});

router.get("/pricing", async (req, res) => {
  const { customTier, bankGameRange } = await getCatalogData(req);
  res.render("pricing", { customTier, bankGameRange });
});

router.get("/games", async (req, res) => {
  const { catalogGames, customTier } = await getCatalogData(req);
  res.render("games", { catalogGames, customTier });
});

module.exports = router;
