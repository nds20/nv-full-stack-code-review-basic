-- Smoke Shop API — migration: add Stripe payment fields to an EXISTING
-- D1 database (one that was set up with an earlier schema.sql, before
-- Stripe checkout existed). Fresh databases don't need this — the
-- current schema.sql already includes these columns.
--
-- Run this ONCE in the D1 console for your existing database (the same
-- Console tab where schema.sql, seed.sql and migration-customers.sql
-- went). The statements only ADD columns with defaults — existing orders
-- are untouched and read as payment_status 'unpaid' with no Stripe
-- session, exactly as they behaved before.
--
-- Note: unlike the CREATE TABLE migrations, ALTER TABLE ... ADD COLUMN
-- cannot be re-run — a second run fails with "duplicate column name".
-- That error is expected and harmless; it means the migration already
-- landed. If the console reports a syntax error when the whole file is
-- pasted at once, run the statements one at a time instead — each one is
-- complete and valid on its own.
--
-- What each column is for:
--   payment_status           'unpaid' | 'pending' | 'paid' | 'payment_failed'
--   stripe_session_id        the Stripe Checkout Session paying this order
--   stripe_payment_intent_id the resulting PaymentIntent (set when paid)
--   access_token             random per-order secret issued to the buyer
--                            at checkout; gates the public order-status
--                            and start-payment endpoints for that order

ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid';

ALTER TABLE orders ADD COLUMN stripe_session_id TEXT;

ALTER TABLE orders ADD COLUMN stripe_payment_intent_id TEXT;

ALTER TABLE orders ADD COLUMN access_token TEXT;
