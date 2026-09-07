const express = require("express");
const { createToken } = require("../lib/accessToken");
const { setCookie } = require("../lib/cookies");
const { COOKIE_NAME } = require("../middleware/accessGate");

const router = express.Router();

router.get("/access", (req, res) => {
  const redirectTo = typeof req.query.redirect === "string" ? req.query.redirect : "/";
  res.render("access", { error: false, redirectTo });
});

router.post("/access", (req, res) => {
  const password = String(req.body.password || "");
  const redirectTo = typeof req.body.redirect === "string" ? req.body.redirect : "/";

  if (password !== process.env.ACCESS_GATE_PASSWORD) {
    return res.status(401).render("access", { error: true, redirectTo });
  }

  setCookie(res, COOKIE_NAME, createToken(), { maxAgeMs: 30 * 24 * 60 * 60 * 1000 });
  res.redirect(redirectTo);
});

module.exports = router;
