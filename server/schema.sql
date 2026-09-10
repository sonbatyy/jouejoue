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

-- "For Companies": a business (e.g. a florist) attaches a JoueJoue game to
-- its products via printed QR codes. Onboarding is request-access — a
-- company submits an enquiry here, then an operator provisions a companies
-- row and sends them a dashboard link.
CREATE TABLE IF NOT EXISTS company_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name  TEXT NOT NULL,
  contact_name  TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  sells         TEXT NOT NULL DEFAULT '',   -- what they sell / attach games to
  volume        TEXT NOT NULL DEFAULT '',   -- rough monthly volume, free text
  message       TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'new',  -- 'new' | 'provisioned' | 'declined'
  created_at    INTEGER NOT NULL
);

-- A provisioned company. manage_token is the only "login" (magic link),
-- same pattern as subscriptions.
CREATE TABLE IF NOT EXISTS companies (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  manage_token  TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  accent_color  TEXT NOT NULL DEFAULT '',   -- optional brand colour for the play page
  logo_url      TEXT NOT NULL DEFAULT '',   -- optional brand logo for the play page
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_companies_manage_token ON companies(manage_token);

-- One purchased run of codes: a game template + difficulty + either a fixed
-- question or a personalize-first flow, in a chosen quantity. Mock checkout.
CREATE TABLE IF NOT EXISTS company_batches (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id       INTEGER NOT NULL REFERENCES companies(id),
  template_id      INTEGER NOT NULL REFERENCES game_templates(id),
  level            TEXT NOT NULL DEFAULT 'medium',
  mode             TEXT NOT NULL DEFAULT 'fixed',      -- 'fixed' | 'personalized'
  default_question TEXT NOT NULL DEFAULT '',           -- used for 'fixed' mode
  answers_to       TEXT NOT NULL DEFAULT 'buyer',      -- 'buyer' | 'company'
  quantity         INTEGER NOT NULL,
  price_display    TEXT NOT NULL,
  currency         TEXT NOT NULL,
  logo_url         TEXT NOT NULL DEFAULT '',
  accent_color     TEXT NOT NULL DEFAULT '',
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_company_batches_company ON company_batches(company_id);

-- One printable QR code. shortcode is what /g/:shortcode resolves. A game
-- instance is created lazily on first scan (fixed) or after the buyer
-- personalizes it, and its token is stored back here.
CREATE TABLE IF NOT EXISTS company_codes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id       INTEGER NOT NULL REFERENCES company_batches(id),
  shortcode      TEXT UNIQUE NOT NULL,
  instance_token TEXT,                       -- game_instances.token once one exists
  personalized   INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_company_codes_shortcode ON company_codes(shortcode);
CREATE INDEX IF NOT EXISTS idx_company_codes_batch ON company_codes(batch_id);

-- One row per scan of a /g/:shortcode link — the dynamic-QR analytics.
CREATE TABLE IF NOT EXISTS code_scans (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code_id      INTEGER NOT NULL REFERENCES company_codes(id),
  scanned_at   INTEGER NOT NULL,
  country_code TEXT,
  user_agent   TEXT
);
CREATE INDEX IF NOT EXISTS idx_code_scans_code ON code_scans(code_id);
