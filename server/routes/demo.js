const express = require("express");

const router = express.Router();

const DEMO_QUESTION = "What should we try next?";
const VALID_SLUGS = ["cake-catch", "duck-catch", "flappy-bird", "cooking"];

router.get("/demo", (req, res) => {
  const templateSlug = VALID_SLUGS.includes(req.query.game) ? req.query.game : "cake-catch";
  res.render("demo", {
    playData: { templateSlug, question: DEMO_QUESTION },
  });
});

module.exports = router;
