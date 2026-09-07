CREATE TABLE IF NOT EXISTS game_templates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT UNIQUE NOT NULL,        -- 'cake-catch', 'duck-catch', 'custom'
  name            TEXT NOT NULL,
  description     TEXT,
  price_egp       INTEGER NOT NULL,            -- whole EGP, mock amount
  price_usd_cents INTEGER NOT NULL,            -- mock amount, wired to real billing later
  is_custom_tier  INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS game_instances (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id    INTEGER NOT NULL REFERENCES game_templates(id),
  token          TEXT UNIQUE NOT NULL,
  buyer_email    TEXT NOT NULL,
  question       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending | answered
  answer         TEXT,
  answered_at    INTEGER,
  created_at     INTEGER NOT NULL,
  expires_at     INTEGER NOT NULL,
  renewed_count  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_game_instances_token ON game_instances(token);

CREATE TABLE IF NOT EXISTS custom_game_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_email  TEXT NOT NULL,
  game_idea    TEXT NOT NULL,  -- what they want the game to be
  purpose      TEXT NOT NULL,  -- what it's for (the occasion)
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  message      TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
