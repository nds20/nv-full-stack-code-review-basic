-- Smoke Shop API — migration: add customer accounts to an EXISTING D1
-- database (one that was set up with an earlier schema.sql, before
-- customer accounts existed). Fresh databases don't need this — the
-- current schema.sql already includes both tables.
--
-- Run this in the D1 console for your existing database (the same
-- Console tab where schema.sql and seed.sql went). Both statements are
-- CREATE TABLE IF NOT EXISTS, so the migration is safe to re-run and
-- never touches existing data.
--
-- Note: if the console reports a syntax error when the whole file is
-- pasted at once, run the two statements one at a time instead — the
-- statements themselves are complete and valid on their own.

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL COLLATE NOCASE UNIQUE,
  salt       TEXT NOT NULL,
  hash       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
