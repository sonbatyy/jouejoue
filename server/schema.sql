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
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id     INTEGER NOT NULL REFERENCES game_templates(id),
  token           TEXT UNIQUE NOT NULL,
  buyer_email     TEXT NOT NULL,
  recipient_name  TEXT NOT NULL DEFAULT '',   -- who's playing, so the win screen can say "Bravo <name>"
  question        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | answered
  answer          TEXT,
  answered_at     INTEGER,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  renewed_count   INTEGER NOT NULL DEFAULT 0,
  sender_name     TEXT NOT NULL DEFAULT '',   -- who it's from, shown to the recipient
  note            TEXT NOT NULL DEFAULT '',   -- optional personal message, separate from the game question
  delivery_method TEXT NOT NULL DEFAULT 'link',  -- 'link' (buyer sends it themselves) | 'email' (we email the recipient directly)
  recipient_email TEXT,                       -- only set when delivery_method = 'email'
  level           TEXT NOT NULL DEFAULT 'medium'  -- 'easy' | 'medium' | 'hard' — chosen by the buyer, read by the game itself
);
CREATE INDEX IF NOT EXISTS idx_game_instances_token ON game_instances(token);

CREATE TABLE IF NOT EXISTS custom_game_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id  INTEGER REFERENCES game_templates(id),  -- which custom tier this went through checkout for
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

-- One row per completed mock payment across every paid flow (purchase,
-- renewal, custom request, and later subscriptions) — a persistent,
-- itemized record, not just an email that could get lost. Never touches
-- card fields (this app's checkout never reads them at all); "paid via"
-- stays a plain description of the flow, not a fabricated card number.
CREATE TABLE IF NOT EXISTS receipts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_number  TEXT UNIQUE NOT NULL,   -- e.g. JJ-20260910-0001, shown to the buyer
  kind            TEXT NOT NULL,          -- 'purchase' | 'renewal' | 'custom_request' | 'subscription'
  buyer_email     TEXT NOT NULL,
  buyer_name      TEXT NOT NULL DEFAULT '',
  item_name       TEXT NOT NULL,
  item_detail     TEXT NOT NULL DEFAULT '',  -- e.g. "For Yara" / "Renewal — new expiry Oct 10"
  amount_display  TEXT NOT NULL,          -- localized price string as shown to the buyer, e.g. "100 EGP"
  currency        TEXT NOT NULL,
  related_token   TEXT,                   -- game_instances.token, when applicable
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_buyer_email ON receipts(buyer_email);

-- A monthly plan: 'random' auto-picks a bank game for the recipient each
-- cycle, 'personalized' turns each cycle into a custom-game request instead.
-- No real recurring billing exists here (nothing auto-charges — this is
-- still a mock checkout) — delivery is pulled, not pushed: the manage page
-- shows a "Get this month's game" button that only works once a real month
-- has actually passed since the last delivery, same honesty as the rest of
-- this app's mock payments.
CREATE TABLE IF NOT EXISTS subscriptions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  manage_token      TEXT UNIQUE NOT NULL,
  tier              TEXT NOT NULL,             -- 'random' | 'personalized'
  subscriber_name   TEXT NOT NULL,
  subscriber_email  TEXT NOT NULL,
  recipient_name    TEXT NOT NULL,
  recipient_email   TEXT NOT NULL,
  question          TEXT NOT NULL DEFAULT '',  -- reused every cycle for the 'random' tier
  game_idea         TEXT NOT NULL DEFAULT '',  -- reused every cycle for the 'personalized' tier
  status            TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'cancelled'
  started_at        INTEGER NOT NULL,
  last_delivered_at INTEGER NOT NULL,
  deliveries_count  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_manage_token ON subscriptions(manage_token);
