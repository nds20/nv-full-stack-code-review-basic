// Validation/normalization — a line-for-line port of the rules in
// ../../server/index.js (normalizeProduct / normalizeOrder). If you change
// a rule here, change it there too: the two runtimes share one contract.

import { fail, round2 } from './http.js';

// The storefront's filter list (ProductsPage.jsx) — a product only shows up
// in a category filter if its category is one of these ids.
export const CATEGORIES = ['flower', 'vapes', 'gummies', 'pouches', 'nic-vapes'];

// Decorative card-gradient defaults for products created without colors.
// (UI chrome, not product data.)
export const DEFAULT_TILE = ['#374151', '#111827'];

// Same 10.2% sales tax the storefront applies (CartContext / CheckoutPage).
export const TAX_RATE = 0.102;

function parseOptionalNumber(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) fail(400, `${field} must be a number`);
  return num;
}

function parseEffects(value) {
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    // Multipart forms send the array JSON-encoded (see buildProductBody).
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((e) => String(e).trim()).filter(Boolean);
    } catch { /* fall through to comma-split */ }
  }
  if (Array.isArray(value)) return value.map((e) => String(e).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((e) => e.trim()).filter(Boolean);
  return [];
}

function parseTile(value) {
  let tile = value;
  if (typeof tile === 'string') {
    try { tile = JSON.parse(tile); } catch { tile = null; }
  }
  if (
    Array.isArray(tile) && tile.length === 2 &&
    tile.every((c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c))
  ) {
    return tile;
  }
  return DEFAULT_TILE;
}

/**
 * Normalize + validate a product coming from the admin form (multipart
 * fields arrive as strings; JSON bodies arrive typed — both are handled
 * here). Data honesty rule: price and THC stay null ("TBD") when the admin
 * leaves them empty. Nothing is invented for them.
 */
export function normalizeProduct(body, existing) {
  const base = existing || {};
  const pick = (field) => (body[field] !== undefined ? body[field] : base[field]);

  const name = String(pick('name') || '').trim();
  if (!name) fail(400, 'name is required');

  const category = String(pick('category') || '').trim();
  if (!CATEGORIES.includes(category)) {
    fail(400, `category must be one of: ${CATEGORIES.join(', ')}`);
  }

  const type = String(pick('type') || '').trim();
  if (!type) {
    fail(400, 'type is required (e.g. Hybrid, Indica, Sativa, Nicotine, Flower)');
  }

  const price = parseOptionalNumber(pick('price'), 'price');
  if (price !== null && price < 0) fail(400, 'price must be zero or greater');

  const thc = parseOptionalNumber(pick('thc'), 'thc');
  if (thc !== null && (thc < 0 || thc > 100)) fail(400, 'thc must be between 0 and 100');

  // Display strength: explicit admin label wins; otherwise derive it from
  // the THC value the admin actually entered; otherwise it stays "THC TBD".
  const strengthInput = pick('strength');
  const strength = String(strengthInput || '').trim()
    || (thc !== null ? `${thc}% THC` : 'THC TBD');

  const unitInput = pick('unit');
  const unit = unitInput === undefined || unitInput === null || String(unitInput).trim() === ''
    ? null
    : String(unitInput).trim();

  return {
    name,
    subtitle: String(pick('subtitle') || '').trim(),
    category,
    type,
    thc,
    strength,
    price,
    unit,
    effects: parseEffects(pick('effects')),
    tile: parseTile(pick('tile')),
    image: pick('image') !== undefined ? pick('image') : (base.image || null),
  };
}

/**
 * Validate + normalize an incoming order. Prices and totals are recomputed
 * from the catalog — a client cannot name its own prices — and the shop's
 * standing rule is enforced server-side too: a product whose price is null
 * ("Price TBD") can never be ordered. Payment card data is reduced to its
 * last four digits; the full number, expiry and CVV are never stored.
 *
 * `getProductById` is the D1 lookup (db.js getProduct) — the only change
 * from the Node version, where the in-memory store lookup was synchronous.
 */
export async function normalizeOrder(body, getProductById) {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) fail(400, 'Order must contain at least one item.');

  const items = [];
  for (const raw of rawItems) {
    const productId = raw ? (raw.productId !== undefined ? raw.productId : raw.id) : undefined;
    // eslint-disable-next-line no-await-in-loop
    const product = await getProductById(productId);
    if (!product) fail(400, `Unknown product in order (id: ${productId}).`);
    if (product.price === null || product.price === undefined) {
      fail(400, `"${product.name}" cannot be ordered yet — its price is TBD.`);
    }
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
      fail(400, `Quantity for "${product.name}" must be a whole number between 1 and 10.`);
    }
    const unitPrice = round2(product.price);
    items.push({
      productId: product.id,
      name: product.name,
      qty,
      unitPrice,
      lineTotal: round2(unitPrice * qty),
    });
  }

  const customer = body.customer || body.delivery || {};
  for (const field of ['fullName', 'phone', 'address', 'city', 'zip']) {
    if (!String(customer[field] || '').trim()) fail(400, `Customer ${field} is required.`);
  }

  const subtotal = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));
  const tax = round2(subtotal * TAX_RATE);

  let payment = null;
  const cardDigits = body.payment && body.payment.cardNumber
    ? String(body.payment.cardNumber).replace(/\D/g, '')
    : '';
  if (cardDigits) payment = { method: 'card', last4: cardDigits.slice(-4) };

  return {
    items,
    subtotal,
    tax,
    total: round2(subtotal + tax),
    customer: {
      fullName: String(customer.fullName).trim(),
      phone: String(customer.phone).trim(),
      address: String(customer.address).trim(),
      city: String(customer.city).trim(),
      zip: String(customer.zip).trim(),
      notes: String(customer.notes || '').trim(),
    },
    payment,
  };
}
