const crypto = require("crypto");

// The plain opaque token — still used as a fallback when a name doesn't
// slugify to anything (empty, all-emoji, etc).
function generateToken() {
  return crypto.randomBytes(16).toString("base64url");
}

// Turns "Layla ✨" into "layla" — strips accents/diacritics rather than
// dropping accented letters outright, so "José" becomes "jose" not "js".
function slugifyName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

// A personalized link instead of a fully opaque one — "juju-4821" reads as
// a gift made for someone, not a random string. isTaken checks uniqueness
// (a random 4-digit suffix collides eventually at real volume); falls back
// to a fully random token if the name doesn't slugify to anything at all.
function generatePersonalizedToken(name, isTaken) {
  const slug = slugifyName(name);
  if (!slug) return generateToken();

  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${slug}-${suffix}`;
    if (!isTaken(candidate)) return candidate;
  }
  // Extremely unlucky (or a very popular name) — widen the suffix rather
  // than looping forever.
  return `${slug}-${crypto.randomBytes(4).toString("hex")}`;
}

module.exports = { generateToken, generatePersonalizedToken, slugifyName };
