const express = require("express");
const db = require("../db");
const { resolveCurrency, withLocalizedPrice, formatEgp, formatConverted } = require("../lib/pricing");

const router = express.Router();

router.get("/", async (req, res) => {
  const currency = await resolveCurrency(req);
  const templates = db.prepare("SELECT * FROM game_templates ORDER BY is_custom_tier ASC, id ASC").all();
  const catalogGames = templates.filter((t) => !t.is_custom_tier).map((t) => withLocalizedPrice(t, currency));
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

  res.render("landing", { catalogGames, customTier, bankGameRange });
});

module.exports = router;
