'use strict';

/**
 * Smoke Shop product API + admin backend.
 *
 * Lives inside smokeshopfrontend/server/ next to the React app it feeds.
 *
 *   - Public:  GET    /api/products            product catalog (JSON store)
 *              GET    /api/products/:id
 *   - Admin:   POST   /api/admin/login         env-configured credentials -> token
 *              POST   /api/products            create (JSON or multipart + photo)
 *              PUT    /api/products/:id        update (JSON or multipart + photo)
 *              DELETE /api/products/:id
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
app.post('/api/admin/login', (req, res) => {
  if (!auth.isConfigured()) {
    return res.status(503).json({
      error: 'Admin login is not configured. Set SMOKESHOP_ADMIN_USER and SMOKESHOP_ADMIN_PASSWORD for the server.',
    });
  }
  const { username, password } = req.body || {};
  if (!auth.checkCredentials(username, password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  return res.json(auth.issueToken(username));
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
  if (!auth.isConfigured()) {
    console.warn('WARNING: SMOKESHOP_ADMIN_USER / SMOKESHOP_ADMIN_PASSWORD are not set — admin login is disabled.');
  } else if (!process.env.SMOKESHOP_ADMIN_SECRET) {
    console.warn('WARNING: SMOKESHOP_ADMIN_SECRET is not set — session tokens are signed with a key derived from the admin password. Set it in production.');
  }
});
