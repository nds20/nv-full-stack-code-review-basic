// Data access for the Cloudflare port — the same stores as the Node
// server (server/src/store.js, ordersStore.js, accounts.js), backed by a
// D1 database bound as `DB` instead of JSON files on disk.
//
// Table/column mapping (see ../../cloudflare/schema.sql):
//   products        one row per product; the JSON-ish fields `effects`
//                   and `tile` are TEXT columns holding JSON strings and
//                   are parsed back into arrays here, so API responses are
//                   byte-for-byte the same shape as the Node server's.
//   orders          one row per order; `items`, `customer` and `payment`
//                   are TEXT columns holding JSON (payment is NULL or a
//                   JSON object with only { method, last4 } — full card
//                   data is never stored, same rule as Node). Stripe
//                   payments add flat columns (migration-stripe.sql):
//                   `payment_status` ('unpaid' | 'pending' | 'paid' |
//                   'payment_failed'), `stripe_session_id`,
//                   `stripe_payment_intent_id`, and `access_token` — a
//                   random per-order secret the buyer's browser holds so
//                   it can read that one order's status and start its
//                   checkout without an account.
//   admin_accounts  username (case-insensitive PK), salt, hash, created_at
//                   — passwords only ever as PBKDF2 hashes (see auth.js).
//   customers       shopper accounts: incrementing id, name, unique
//                   case-insensitive email, PBKDF2 salt/hash, created_at.
//                   Never seeded — the first registration is customer 1.
//   app_settings    key/value rows; currently holds the generated
//                   customer-token signing secret (see
//                   getCustomerTokenSecret below).
//
// Ids are INTEGER AUTOINCREMENT, matching the Node stores' incrementing
// integer ids.

import {
  newPasswordRecord,
  verifyPassword,
  hashPassword,
  base64Encode,
} from './auth.js';

function parseJsonColumn(value, fallback) {
  if (value === null || value === undefined) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

// ----- Products ---------------------------------------------------------------

export function rowToProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    category: row.category,
    type: row.type,
    thc: row.thc,
    strength: row.strength,
    price: row.price,
    unit: row.unit,
    effects: parseJsonColumn(row.effects, []),
    tile: parseJsonColumn(row.tile, ['#374151', '#111827']),
    image: row.image,
  };
}

export async function listProducts(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, subtitle, category, type, thc, strength, price, unit, effects, tile, image FROM products ORDER BY id ASC'
  ).all();
  return results.map(rowToProduct);
}

export async function getProduct(env, id) {
  const pid = Number(id);
  if (!Number.isFinite(pid)) return null;
  const row = await env.DB.prepare(
    'SELECT id, name, subtitle, category, type, thc, strength, price, unit, effects, tile, image FROM products WHERE id = ?'
  )
    .bind(pid)
    .first();
  return rowToProduct(row);
}

function productParams(data) {
  return [
    data.name,
    data.subtitle,
    data.category,
    data.type,
    data.thc,
    data.strength,
    data.price,
    data.unit,
    JSON.stringify(data.effects),
    JSON.stringify(data.tile),
    data.image,
  ];
}

export async function createProduct(env, data) {
  const result = await env.DB.prepare(
    `INSERT INTO products (name, subtitle, category, type, thc, strength, price, unit, effects, tile, image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(...productParams(data))
    .run();
  return getProduct(env, result.meta.last_row_id);
}

export async function updateProduct(env, id, data) {
  const pid = Number(id);
  if (!Number.isFinite(pid)) return null;
  await env.DB.prepare(
    `UPDATE products
     SET name = ?, subtitle = ?, category = ?, type = ?, thc = ?, strength = ?,
         price = ?, unit = ?, effects = ?, tile = ?, image = ?
     WHERE id = ?`
  )
    .bind(...productParams(data), pid)
    .run();
  return getProduct(env, pid);
}

/** Point a product at a new image URL (used after an R2 photo upload). */
export async function updateProductImage(env, id, image) {
  const pid = Number(id);
  if (!Number.isFinite(pid)) return null;
  await env.DB.prepare('UPDATE products SET image = ? WHERE id = ?')
    .bind(image, pid)
    .run();
  return getProduct(env, pid);
}

export async function removeProduct(env, id) {
  const pid = Number(id);
  if (!Number.isFinite(pid)) return false;
  const result = await env.DB.prepare('DELETE FROM products WHERE id = ?')
    .bind(pid)
    .run();
  return result.meta.changes > 0;
}

// ----- Orders -----------------------------------------------------------------

export function rowToOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    items: parseJsonColumn(row.items, []),
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    customer: parseJsonColumn(row.customer, {}),
    payment: parseJsonColumn(row.payment, null),
    status: row.status,
    createdAt: row.created_at,
    seenAt: row.seen_at,
    // Stripe payment lifecycle (columns added by migration-stripe.sql;
    // orders from before it read as 'unpaid' with no session).
    paymentStatus: row.payment_status || 'unpaid',
    stripeSessionId: row.stripe_session_id || null,
    stripePaymentIntentId: row.stripe_payment_intent_id || null,
    accessToken: row.access_token || null,
  };
}

const ORDER_COLUMNS =
  'id, items, subtotal, tax, total, customer, payment, status, created_at, seen_at, payment_status, stripe_session_id, stripe_payment_intent_id, access_token';

/** All orders, newest first — same as the Node orders store. */
export async function listOrders(env) {
  const { results } = await env.DB.prepare(
    `SELECT ${ORDER_COLUMNS} FROM orders ORDER BY id DESC`
  ).all();
  return results.map(rowToOrder);
}

export async function getOrder(env, id) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) return null;
  const row = await env.DB.prepare(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ?`)
    .bind(oid)
    .first();
  return rowToOrder(row);
}

/** A random per-order access token (hex) — see the orders mapping note. */
export function newOrderAccessToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createOrder(env, data) {
  const result = await env.DB.prepare(
    `INSERT INTO orders (items, subtotal, tax, total, customer, payment, status, created_at, seen_at, payment_status, stripe_session_id, stripe_payment_intent_id, access_token)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?, NULL, 'unpaid', NULL, NULL, ?)`
  )
    .bind(
      JSON.stringify(data.items),
      data.subtotal,
      data.tax,
      data.total,
      JSON.stringify(data.customer),
      data.payment ? JSON.stringify(data.payment) : null,
      new Date().toISOString(),
      newOrderAccessToken()
    )
    .run();
  return getOrder(env, result.meta.last_row_id);
}

/**
 * Patch an order's Stripe payment fields. Only the keys present in
 * `patch` are written (camelCase in, snake_case columns out):
 * { paymentStatus, stripeSessionId, stripePaymentIntentId }.
 * Returns the updated order, or null when it does not exist.
 */
export async function updateOrderPayment(env, id, patch) {
  const existing = await getOrder(env, id);
  if (!existing) return null;
  const sets = [];
  const values = [];
  if (patch.paymentStatus !== undefined) {
    sets.push('payment_status = ?');
    values.push(patch.paymentStatus);
  }
  if (patch.stripeSessionId !== undefined) {
    sets.push('stripe_session_id = ?');
    values.push(patch.stripeSessionId);
  }
  if (patch.stripePaymentIntentId !== undefined) {
    sets.push('stripe_payment_intent_id = ?');
    values.push(patch.stripePaymentIntentId);
  }
  if (sets.length === 0) return existing;
  await env.DB.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values, existing.id)
    .run();
  return getOrder(env, existing.id);
}

/** Find the order a Stripe Checkout Session belongs to (webhook lookup). */
export async function findOrderByStripeSessionId(env, sessionId) {
  if (!sessionId) return null;
  const row = await env.DB.prepare(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE stripe_session_id = ?`
  )
    .bind(String(sessionId))
    .first();
  return rowToOrder(row);
}

/**
 * Acknowledge an order: status 'new' -> 'seen', stamping seenAt the first
 * time. Idempotent, like the Node store. Returns null when missing.
 */
export async function markOrderSeen(env, id) {
  const existing = await getOrder(env, id);
  if (!existing) return null;
  if (existing.status !== 'seen') {
    await env.DB.prepare(
      "UPDATE orders SET status = 'seen', seen_at = ? WHERE id = ?"
    )
      .bind(new Date().toISOString(), existing.id)
      .run();
    return getOrder(env, existing.id);
  }
  return existing;
}

export async function countNewOrders(env) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM orders WHERE status = 'new'"
  ).first();
  return row ? row.n : 0;
}

// ----- Admin accounts -----------------------------------------------------------

export async function hasAccounts(env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_accounts').first();
  return row ? row.n > 0 : false;
}

export async function findAccount(env, username) {
  const wanted = String(username || '').trim();
  if (!wanted) return null;
  // The username column is COLLATE NOCASE, so this match is case-insensitive
  // exactly like the Node accounts store's find().
  return env.DB.prepare(
    'SELECT username, salt, hash, created_at FROM admin_accounts WHERE username = ?'
  )
    .bind(wanted)
    .first();
}

export async function createAccount(env, username, password) {
  const name = String(username || '').trim();
  const { salt, hash } = await newPasswordRecord(password);
  const createdAt = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO admin_accounts (username, salt, hash, created_at) VALUES (?, ?, ?, ?)'
  )
    .bind(name, salt, hash, createdAt)
    .run();
  return { username: name, createdAt };
}

/** Constant-time credential check against the stored (hashed) accounts. */
export async function verifyAccount(env, username, password) {
  const account = await findAccount(env, username);
  if (!account) {
    // Burn a comparable amount of work so unknown usernames are not
    // trivially distinguishable by timing (same trick as the Node store).
    await hashPassword(password || '', new TextEncoder().encode('unknown-user-salt'));
    return false;
  }
  return verifyPassword(password || '', account.salt, account.hash);
}

// ----- Customers ------------------------------------------------------------------
// The shopper-facing counterpart of the admin accounts above, mirroring
// server/src/customers.js: emails are stored trimmed + lowercased and are
// unique case-insensitively, passwords are PBKDF2 hashes, and NOTHING is
// seeded — the first registration is customer 1.

export function rowToCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Raw row (includes salt/hash) for credential checks; null when absent. */
export async function findCustomerRowByEmail(env, email) {
  const wanted = normalizeEmail(email);
  if (!wanted) return null;
  return env.DB.prepare(
    'SELECT id, name, email, salt, hash, created_at FROM customers WHERE email = ?'
  )
    .bind(wanted)
    .first();
}

/** Existence check used by registration (duplicate email -> 409). */
export async function findCustomerByEmail(env, email) {
  const row = await findCustomerRowByEmail(env, email);
  return rowToCustomer(row);
}

export async function getCustomerById(env, id) {
  const cid = Number(id);
  if (!Number.isFinite(cid)) return null;
  const row = await env.DB.prepare(
    'SELECT id, name, email, created_at FROM customers WHERE id = ?'
  )
    .bind(cid)
    .first();
  return rowToCustomer(row);
}

export async function createCustomer(env, { name, email, password }) {
  const { salt, hash } = await newPasswordRecord(password);
  const createdAt = new Date().toISOString();
  const result = await env.DB.prepare(
    'INSERT INTO customers (name, email, salt, hash, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(String(name || '').trim(), normalizeEmail(email), salt, hash, createdAt)
    .run();
  return getCustomerById(env, result.meta.last_row_id);
}

/**
 * Credential check for customer sign-in. Returns the public customer on
 * success, null on any failure — unknown email and wrong password are
 * indistinguishable (no account enumeration).
 */
export async function verifyCustomerCredentials(env, email, password) {
  const row = await findCustomerRowByEmail(env, email);
  if (!row) {
    // Burn a comparable amount of work, same trick as verifyAccount.
    await hashPassword(password || '', new TextEncoder().encode('unknown-customer-salt'));
    return null;
  }
  const ok = await verifyPassword(password || '', row.salt, row.hash);
  return ok ? rowToCustomer(row) : null;
}

// ----- App settings (key/value) ---------------------------------------------------

/**
 * The random secret that signs customer session tokens. It is generated
 * on first use and persisted in the `app_settings` table, so customer
 * tokens work with zero configuration yet cannot be forged from the
 * public source code. Deliberately independent of the admin signing key:
 * the two token audiences never share key material.
 */
export async function getCustomerTokenSecret(env) {
  const read = () =>
    env.DB.prepare("SELECT value FROM app_settings WHERE key = 'customer_token_secret'").first();
  const existing = await read();
  if (existing && existing.value) return existing.value;
  const secret = base64Encode(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare(
    "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('customer_token_secret', ?)"
  )
    .bind(secret)
    .run();
  const saved = await read();
  return saved.value;
}
