const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const db = new Database(path.join(DATA_DIR, "marketplace.db"));
db.pragma("journal_mode = WAL");

const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema);

// Migration: CREATE TABLE IF NOT EXISTS above doesn't touch a table that
// already exists, so a column added to schema.sql after the table was first
// created needs to be added explicitly too.
const instanceColumns = db.prepare("PRAGMA table_info(game_instances)").all().map((c) => c.name);
if (!instanceColumns.includes("recipient_name")) {
  db.exec("ALTER TABLE game_instances ADD COLUMN recipient_name TEXT NOT NULL DEFAULT ''");
}
if (!instanceColumns.includes("sender_name")) {
  db.exec("ALTER TABLE game_instances ADD COLUMN sender_name TEXT NOT NULL DEFAULT ''");
}
if (!instanceColumns.includes("note")) {
  db.exec("ALTER TABLE game_instances ADD COLUMN note TEXT NOT NULL DEFAULT ''");
}
if (!instanceColumns.includes("delivery_method")) {
  db.exec("ALTER TABLE game_instances ADD COLUMN delivery_method TEXT NOT NULL DEFAULT 'link'");
}
if (!instanceColumns.includes("recipient_email")) {
  db.exec("ALTER TABLE game_instances ADD COLUMN recipient_email TEXT");
}
if (!instanceColumns.includes("level")) {
  db.exec("ALTER TABLE game_instances ADD COLUMN level TEXT NOT NULL DEFAULT 'medium'");
}

const customRequestColumns = db.prepare("PRAGMA table_info(custom_game_requests)").all().map((c) => c.name);
if (!customRequestColumns.includes("template_id")) {
  db.exec("ALTER TABLE custom_game_requests ADD COLUMN template_id INTEGER REFERENCES game_templates(id)");
}

// Idempotent per-slug seeding (not "only if the table is empty") so adding a
// new game template later doesn't require wiping existing instances/orders
// tied to the templates already there.
const now = Date.now();
const insertIfMissing = db.prepare(`
  INSERT OR IGNORE INTO game_templates (slug, name, description, price_egp, price_usd_cents, is_custom_tier, created_at)
  VALUES (@slug, @name, @description, @price_egp, @price_usd_cents, @is_custom_tier, @created_at)
`);
const seed = db.transaction((rows) => rows.forEach((row) => insertIfMissing.run(row)));
seed([
  {
    slug: "cake-catch",
    name: "Catch the Cake",
    description: "A cake runs around the screen. Catch it three times, faster each round, and they answer your question.",
    price_egp: 100,
    price_usd_cents: 300,
    is_custom_tier: 0,
    created_at: now,
  },
  {
    slug: "duck-catch",
    name: "Catch the Duck",
    description: "A fast duck darts around the screen. Catch it three times, faster each round, then they answer your question.",
    price_egp: 50,
    price_usd_cents: 200,
    is_custom_tier: 0,
    created_at: now,
  },
  {
    slug: "flappy-bird",
    name: "Flappy",
    description: "Tap to flap and thread the gaps. Get 30 and they answer your question.",
    price_egp: 90,
    price_usd_cents: 300,
    is_custom_tier: 0,
    created_at: now,
  },
  {
    slug: "cooking",
    name: "Catch It",
    description: "Fruits and veg fall from the top. Catch enough of the one you're told before time runs out, then they answer your question.",
    price_egp: 75,
    price_usd_cents: 250,
    is_custom_tier: 0,
    created_at: now,
  },
  {
    slug: "custom",
    name: "Custom Game",
    description: "Tell us what you want the game to be and what it's for, and we'll build something just for it.",
    price_egp: 200,
    price_usd_cents: 500,
    is_custom_tier: 1,
    created_at: now,
  },
]);

// Keep the description in sync even for an already-seeded row (INSERT OR
// IGNORE above only helps for genuinely new slugs).
db.prepare("UPDATE game_templates SET description = ? WHERE slug = 'cake-catch'").run(
  "A cake runs around the screen. Catch it three times, faster each round, and they answer your question."
);
// Cooking was rewritten twice: first from a recipe/ingredients game to a
// catch-the-falling-target game, then to a catch-N-in-time-limit challenge.
// Keep the name/description in sync for anyone already seeded.
db.prepare("UPDATE game_templates SET name = ?, description = ? WHERE slug = 'cooking'").run(
  "Catch It",
  "Fruits and veg fall from the top. Catch enough of the one you're told before time runs out, then they answer your question."
);
// Renamed from "Flap to 20" to just "Flappy" — keep it in sync for anyone
// already seeded (production included).
db.prepare("UPDATE game_templates SET name = ? WHERE slug = 'flappy-bird'").run("Flappy");
// Duck-catch and flappy's difficulty were retuned (three rounds; the win
// score to reach); keep their catalog copy in sync too.
db.prepare("UPDATE game_templates SET description = ? WHERE slug = 'duck-catch'").run(
  "A fast duck darts around the screen. Catch it three times, faster each round, then they answer your question."
);
db.prepare("UPDATE game_templates SET description = ? WHERE slug = 'flappy-bird'").run(
  "Tap to flap and thread the gaps. Get 30 and they answer your question."
);

// Retired: clean up on any environment that already seeded it, and any test
// instances/orders that pointed at it (there's no real purchase history to
// preserve at this stage).
const retired = db.prepare("SELECT id FROM game_templates WHERE slug = 'shoot-bottles'").get();
if (retired) {
  db.prepare("DELETE FROM game_instances WHERE template_id = ?").run(retired.id);
  db.prepare("DELETE FROM game_templates WHERE id = ?").run(retired.id);
}

module.exports = db;
