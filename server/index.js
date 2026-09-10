require("dotenv").config();
require("./db"); // boots schema + seed as a side effect, before routes touch it

const path = require("path");
const express = require("express");
const { accessGate } = require("./middleware/accessGate");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
// So req.ip reflects the real visitor IP (via X-Forwarded-For) once this
// runs behind a reverse proxy/load balancer, not the proxy's own address —
// needed for accurate geo-IP currency detection in production.
app.set("trust proxy", true);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Temporary shared-password gate: this is a prototype with mocked payments,
// not yet meant to be wide open on a link that gets passed around. Remove
// once real payments are in place. Runs before static assets too, except
// for the paths it explicitly exempts (its own page's CSS/JS).
app.use(accessGate);

app.use(express.static(path.join(__dirname, "..", "public")));

app.use(require("./routes/access"));
app.use(require("./routes/catalog"));
app.use(require("./routes/purchase"));
app.use(require("./routes/play"));
app.use(require("./routes/customRequest"));
app.use(require("./routes/receipts"));
app.use(require("./routes/subscriptions"));
app.use(require("./routes/companies"));
app.use(require("./routes/contact"));
app.use(require("./routes/demo"));
if (process.env.NODE_ENV !== "production") {
  app.use(require("./routes/debug"));
}

app.listen(PORT, () => {
  console.log(`Game marketplace running at http://localhost:${PORT}`);
});
