-- Smoke Shop API — D1 schema for the Cloudflare port (Pages Functions).
--
-- Run this ONCE in the D1 console for your database (see README.md in
-- this folder for the full step-by-step), then run seed.sql.
--
-- The tables mirror the Node server's JSON stores one-for-one:
--   products        <- server/data/products.json (seeded from products.seed.json)
--   orders          <- server/data/orders.json
--   admin_accounts  <- server/data/admin-accounts.json
--   customers       <- server/data/customers.json (registered shoppers)
--   app_settings    <- key/value; holds the generated secret that signs
--                      customer session tokens (the Node server keeps the
--                      equivalent inside customers.json)
--
-- Mapping notes:
--   * Ids are INTEGER PRIMARY KEY AUTOINCREMENT, matching the Node
--     stores' incrementing integer ids.
--   * JSON-ish product fields are TEXT columns holding JSON strings:
--       effects  JSON array of strings, e.g. '["Relaxed","Happy"]'
--       tile     JSON array of two hex colors, e.g. '["#ff8c1a","#f5b921"]'
--     The API parses them back into arrays, so responses match the Node
--     server exactly.
--   * price / thc are REAL and NULL means "TBD" — nothing is invented.
--   * Order payloads are TEXT columns holding JSON:
--       items    JSON array of { productId, name, qty, unitPrice, lineTotal }
--       customer JSON object { fullName, phone, address, city, zip, notes }
--       payment  NULL, or JSON { method: 'card', last4 } — ONLY the last
--                four digits are ever stored, never a full card number.
--   * admin_accounts stores PBKDF2-SHA256 password hashes with a
--     per-account salt (base64). Plaintext passwords are never stored.
--     (The Node server uses scrypt; hashes are not interchangeable
--     between the two runtimes.)

CREATE TABLE IF NOT EXISTS products (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  type     TEXT NOT NULL,
  thc      REAL,
  strength TEXT NOT NULL DEFAULT 'THC TBD',
  price    REAL,
  unit     TEXT,
  effects  TEXT NOT NULL DEFAULT '[]',
  tile     TEXT NOT NULL DEFAULT '["#374151","#111827"]',
  image    TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  items      TEXT NOT NULL,
  subtotal   REAL NOT NULL,
  tax        REAL NOT NULL,
  total      REAL NOT NULL,
  customer   TEXT NOT NULL,
  payment    TEXT,
  status     TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL,
  seen_at    TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  access_token TEXT
);

CREATE TABLE IF NOT EXISTS admin_accounts (
  username   TEXT PRIMARY KEY COLLATE NOCASE,
  salt       TEXT NOT NULL,
  hash       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Customer (shopper) accounts. Ids AUTOINCREMENT from 1 and NO rows are
-- seeded: the first person to register is customer 1. Emails are stored
-- lowercased; the UNIQUE + COLLATE NOCASE combination also enforces
-- case-insensitive uniqueness at the database level. Passwords are
-- PBKDF2-SHA256 salt/hash pairs, never plaintext (see admin note above).
CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL COLLATE NOCASE UNIQUE,
  salt       TEXT NOT NULL,
  hash       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Key/value settings. Currently one row: the generated
-- 'customer_token_secret' used to sign customer session tokens
-- (created lazily on first register/login — no manual step needed).
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
