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
//                   data is never stored, same rule as Node).
//   admin_accounts  username (case-insensitive PK), salt, hash, created_at
//                   — passwords only ever as PBKDF2 hashes (see auth.js).
//
// Ids are INTEGER AUTOINCREMENT, matching the Node stores' incrementing
// integer ids.

import {
  newPasswordRecord,
  verifyPassword,
  hashPassword,
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
  };
}

const ORDER_COLUMNS =
  'id, items, subtotal, tax, total, customer, payment, status, created_at, seen_at';

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

export async function createOrder(env, data) {
  const result = await env.DB.prepare(
    `INSERT INTO orders (items, subtotal, tax, total, customer, payment, status, created_at, seen_at)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?, NULL)`
  )
    .bind(
      JSON.stringify(data.items),
      data.subtotal,
      data.tax,
      data.total,
      JSON.stringify(data.customer),
      data.payment ? JSON.stringify(data.payment) : null,
      new Date().toISOString()
    )
    .run();
  return getOrder(env, result.meta.last_row_id);
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
