'use strict';

/**
 * Smoke Shop product API + admin backend.
 *
 * Lives inside smokeshopfrontend/server/ next to the React app it feeds.
 *
 *   - Public:  GET    /api/products            product catalog (JSON store)
 *              GET    /api/products/:id
 *              POST   /api/orders              place an order (validated,
 *                                             totals recomputed server-side)
 *   - Admin:   POST   /api/admin/login         env creds, stored account, or
 *                                             demo fallback -> token
 *              GET    /api/admin/setup-status  does first-run setup apply?
 *              POST   /api/admin/setup         create the FIRST admin account
 *              POST   /api/products            create (JSON or multipart + photo)
 *              PUT    /api/products/:id        update (JSON or multipart + photo)
 *              DELETE /api/products/:id
 *              GET    /api/admin/orders        orders, newest first
 *              GET    /api/admin/orders/:id
 *              PATCH  /api/admin/orders/:id/seen   acknowledge an order
 *
 * Admin sign-in precedence: (1) SMOKESHOP_ADMIN_USER/PASSWORD env vars,
 * (2) an account created via the setup flow (scrypt-hashed, stored in
 * data/admin-accounts.json), (3) a built-in DEMO login (admin/admin123)
 * that is only accepted while neither of the above exists. See README.
 *
 * Product photos are stored in ../public/images/products/ and served from
 * /images/products/... — exactly how the existing product photos are served.
 * If the React build output (../build) exists it is served too, so this one
 * process can run the whole shop:  npm --prefix server start
 *
 * Configure with a .env file here or environment variables — see .env.example.
 * No credentials or secrets are hardcoded.
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const { createStore } = require('./src/store');
const { createOrderStore } = require('./src/ordersStore');
const { createAccountsStore } = require('./src/accounts');
const auth = require('./src/auth');

const FRONTEND_ROOT = path.join(__dirname, '..');
const PUBLIC_IMAGES_DIR = path.join(FRONTEND_ROOT, 'public', 'images');
const UPLOAD_DIR = path.join(PUBLIC_IMAGES_DIR, 'products');
const BUILD_DIR = path.join(FRONTEND_ROOT, 'build');
const DATA_DIR = path.join(__dirname, 'data');
const PORT = Number(process.env.PORT) || 4000;

// The storefront's filter list (ProductsPage.jsx) — a product only shows up
// in a category filter if its category is one of these ids.
const CATEGORIES = ['flower', 'vapes', 'gummies', 'pouches', 'nic-vapes'];
// Decorative card-gradient defaults for products created without colors.
// (UI chrome, not product data.)
const DEFAULT_TILE = ['#374151', '#111827'];
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

const store = createStore(DATA_DIR);
const ordersStore = createOrderStore(DATA_DIR);
const accountsStore = createAccountsStore(DATA_DIR);

// Same 10.2% sales tax the storefront applies (CartContext / CheckoutPage).
const TAX_RATE = 0.102;

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** True only while no real admin credentials exist anywhere. */
function dummyLoginEnabled() {
  return !auth.isConfigured() && !accountsStore.hasAccounts();
}

function slugify(text) {
  return String(text || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'product';
}

function parseOptionalNumber(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    const err = new Error(`${field} must be a number`);
    err.status = 400;
    throw err;
  }
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
 * Normalize + validate a product coming from the admin form (multipart fields
 * arrive as strings; JSON bodies arrive typed — both are handled here).
 * Data honesty rule: price and THC stay null ("TBD") when the admin leaves
 * them empty. Nothing is invented for them.
 */
function normalizeProduct(body, existing) {
  const base = existing || {};
  const pick = (field) => (body[field] !== undefined ? body[field] : base[field]);

  const name = String(pick('name') || '').trim();
  if (!name) {
    const err = new Error('name is required');
    err.status = 400;
    throw err;
  }

  const category = String(pick('category') || '').trim();
  if (!CATEGORIES.includes(category)) {
    const err = new Error(`category must be one of: ${CATEGORIES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const type = String(pick('type') || '').trim();
  if (!type) {
    const err = new Error('type is required (e.g. Hybrid, Indica, Sativa, Nicotine, Flower)');
    err.status = 400;
    throw err;
  }

  const price = parseOptionalNumber(pick('price'), 'price');
  if (price !== null && price < 0) {
    const err = new Error('price must be zero or greater');
    err.status = 400;
    throw err;
  }

  const thc = parseOptionalNumber(pick('thc'), 'thc');
  if (thc !== null && (thc < 0 || thc > 100)) {
    const err = new Error('thc must be between 0 and 100');
    err.status = 400;
    throw err;
  }

  // Display strength: explicit admin label wins; otherwise derive it from the
  // THC value the admin actually entered; otherwise it stays "THC TBD".
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
 */
function normalizeOrder(body) {
  const fail = (message) => {
    const err = new Error(message);
    err.status = 400;
    throw err;
  };

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) fail('Order must contain at least one item.');

  const items = rawItems.map((raw) => {
    const productId = raw ? (raw.productId !== undefined ? raw.productId : raw.id) : undefined;
    const product = store.get(productId);
    if (!product) fail(`Unknown product in order (id: ${productId}).`);
    if (product.price === null || product.price === undefined) {
      fail(`"${product.name}" cannot be ordered yet — its price is TBD.`);
    }
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
      fail(`Quantity for "${product.name}" must be a whole number between 1 and 10.`);
    }
    const unitPrice = round2(product.price);
    return {
      productId: product.id,
      name: product.name,
      qty,
      unitPrice,
      lineTotal: round2(unitPrice * qty),
    };
  });

  const customer = body.customer || body.delivery || {};
  for (const field of ['fullName', 'phone', 'address', 'city', 'zip']) {
    if (!String(customer[field] || '').trim()) fail(`Customer ${field} is required.`);
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

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_IMAGE_EXTENSIONS.has(ext) && (file.mimetype || '').startsWith('image/')) {
      cb(null, true);
    } else {
      const err = new Error('photo must be an image file (jpg, png, webp, gif or svg)');
      err.status = 400;
      cb(err);
    }
  },
});

/** After a product is saved, give its uploaded photo a stable, readable name. */
function finalizePhoto(product, file) {
  if (!file) return product;
  const ext = path.extname(file.filename).toLowerCase();
  const finalName = `${product.id}-${slugify(product.name)}${ext}`;
  const finalPath = path.join(UPLOAD_DIR, finalName);
  try {
    if (path.join(UPLOAD_DIR, file.filename) !== finalPath) {
      fs.renameSync(path.join(UPLOAD_DIR, file.filename), finalPath);
    }
    return store.update(product.id, { image: `/images/products/${finalName}` }) || product;
  } catch {
    return store.update(product.id, { image: `/images/products/${file.filename}` }) || product;
  }
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ----- Public catalog -------------------------------------------------------
app.get('/api/products', (req, res) => {
  res.json(store.all());
});

app.get('/api/products/:id', (req, res) => {
  const product = store.get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  return res.json(product);
});

// ----- Admin ----------------------------------------------------------------
// ----- Admin sign-in ----------------------------------------------------------
// Precedence: (1) env-var credentials, (2) a stored account created via
// setup, (3) the built-in DEMO login — only while neither of the above
// exists. The first match wins; the response says which one matched so the
// UI can warn when the demo login was used.
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};

  let authSource = null;
  if (auth.isConfigured() && auth.checkCredentials(username, password)) {
    authSource = 'env';
  } else if (accountsStore.verify(username, password)) {
    authSource = 'account';
  } else if (dummyLoginEnabled() && auth.checkDummyCredentials(username, password)) {
    authSource = 'demo';
  }

  if (!authSource) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  return res.json({ ...auth.issueToken(String(username).trim()), authSource });
});

// ----- First-run admin setup --------------------------------------------------
// The setup flow exists so an admin account can be created from the UI —
// until now there was no way to get credentials other than env vars.
app.get('/api/admin/setup-status', (req, res) => {
  res.json({
    setupRequired: !accountsStore.hasAccounts(),
    envConfigured: auth.isConfigured(),
    dummyActive: dummyLoginEnabled(),
  });
});

app.post('/api/admin/setup', (req, res) => {
  if (accountsStore.hasAccounts()) {
    return res.status(409).json({
      error: 'An admin account already exists. Setup is only for creating the first account.',
    });
  }
  const { username, password } = req.body || {};
  const name = String(username || '').trim();
  if (name.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const account = accountsStore.create(name, password);
  // Creating a real account disables the demo login from this moment on.
  return res.status(201).json({ ...auth.issueToken(account.username), authSource: 'account' });
});

app.post('/api/products', auth.requireAdmin, upload.single('photo'), (req, res, next) => {
  try {
    const data = normalizeProduct(req.body || {}, null);
    const created = store.create(data);
    return res.status(201).json(finalizePhoto(created, req.file));
  } catch (err) {
    return next(err);
  }
});

app.put('/api/products/:id', auth.requireAdmin, upload.single('photo'), (req, res, next) => {
  try {
    const existing = store.get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    const data = normalizeProduct(req.body || {}, existing);
    const updated = store.update(existing.id, data);
    return res.json(finalizePhoto(updated, req.file));
  } catch (err) {
    return next(err);
  }
});

app.delete('/api/products/:id', auth.requireAdmin, (req, res) => {
  if (!store.remove(req.params.id)) {
    return res.status(404).json({ error: 'Product not found' });
  }
  // Photo files are intentionally left on disk: a file may be referenced by
  // the committed catalog, and deleting user assets is destructive. Remove
  // unwanted files from public/images/products/ manually.
  return res.status(204).end();
});

// ----- Orders -----------------------------------------------------------------
// A customer placing an order needs no account — this is the storefront
// checkout. Validation (incl. the Price-TBD block) and totals happen here,
// never on the client's say-so.
app.post('/api/orders', (req, res, next) => {
  try {
    const order = ordersStore.create(normalizeOrder(req.body || {}));
    return res.status(201).json(order);
  } catch (err) {
    return next(err);
  }
});

// Admin order inbox — this is what powers the admin page's order alerts:
// the dashboard polls the list and badges orders still in status 'new'.
app.get('/api/admin/orders', auth.requireAdmin, (req, res) => {
  res.json({ orders: ordersStore.all(), newCount: ordersStore.newCount() });
});

app.get('/api/admin/orders/:id', auth.requireAdmin, (req, res) => {
  const order = ordersStore.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  return res.json(order);
});

app.patch('/api/admin/orders/:id/seen', auth.requireAdmin, (req, res) => {
  const order = ordersStore.markSeen(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  return res.json(order);
});

// ----- Static files ---------------------------------------------------------
// Product photos — the same /images/products/... URLs the shop already uses.
app.use('/images', express.static(PUBLIC_IMAGES_DIR));

// Serve the React production build when it exists, so one process can run
// the entire shop (storefront + admin + API) after `npm run build`.
if (fs.existsSync(path.join(BUILD_DIR, 'index.html'))) {
  app.use(express.static(BUILD_DIR));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(BUILD_DIR, 'index.html'));
  });
}

// ----- Errors ---------------------------------------------------------------
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Smoke Shop API listening on http://localhost:${PORT}`);
  console.log(`Products: ${store.all().length} loaded from ${path.join(DATA_DIR, 'products.json')}`);
  console.log(`Orders: ${ordersStore.all().length} stored, ${ordersStore.newCount()} new`);
  if (dummyLoginEnabled()) {
    console.warn('WARNING: DEMO admin login is ACTIVE — sign in with username "admin" / password "admin123".');
    console.warn('This is for local demos only. It turns off as soon as you create an admin account (setup on the admin login screen) or set SMOKESHOP_ADMIN_USER / SMOKESHOP_ADMIN_PASSWORD.');
  } else if (accountsStore.hasAccounts()) {
    console.log('Admin sign-in: stored account(s) from setup (plus env credentials if set). Demo login is off.');
  } else if (!auth.isConfigured()) {
    console.warn('WARNING: no admin sign-in method is available.');
  }
  if (auth.isConfigured() && !process.env.SMOKESHOP_ADMIN_SECRET) {
    console.warn('WARNING: SMOKESHOP_ADMIN_SECRET is not set — session tokens are signed with a key derived from the admin password. Set it in production.');
  }
});
