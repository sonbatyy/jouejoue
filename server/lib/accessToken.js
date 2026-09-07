// A signed, tamper-resistant cookie value for the temporary access gate.
// Not a real session system — no expiry, no per-user identity — just proof
// that someone typed the shared password once. Good enough for "keep this
// off random crawlers/link-sharing until real payments exist," nothing more.
const crypto = require("crypto");

function getSecret() {
  const secret = process.env.ACCESS_GATE_SECRET;
  if (!secret) {
    throw new Error("ACCESS_GATE_SECRET is not set. Add it to your .env before starting the server.");
  }
  return secret;
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

function createToken() {
  const value = "granted";
  return `${value}.${sign(value)}`;
}

function isValidToken(token) {
  if (!token || typeof token !== "string") return false;
  const [value, signature] = token.split(".");
  if (!value || !signature) return false;
  const expected = sign(value);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { createToken, isValidToken };
