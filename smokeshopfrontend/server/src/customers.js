'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Customer accounts — the shopper-facing counterpart of the admin
 * accounts in ./accounts.js.
 *
 * Accounts live in `data/customers.json` (git-ignored). Passwords are
 * NEVER stored in plaintext: each account keeps a per-account random
 * salt and a scrypt hash (Node's built-in crypto — no extra
 * dependencies), and verification recomputes the hash and compares with
 * timingSafeEqual. Same scheme as the admin accounts.
 *
 * Record shape: { id, name, email, salt, hash, createdAt }
 *   - ids are incrementing integers (1, 2, 3, ...)
 *   - emails are stored trimmed + lowercased and compared
 *     case-insensitively, so "A@x.com" and "a@x.com" are one account
 *   - NOTHING is seeded: the first person to register is customer 1
 *
 * The file itself is an object, not a bare array like the other stores:
 *   { tokenSecret, customers: [ ...records ] }
 * `tokenSecret` is a random per-installation secret generated on first
 * run. It signs customer session tokens so they work with zero
 * configuration yet cannot be forged from the public source code. It is
 * generated independently of the admin signing key on purpose: customer
 * tokens and admin tokens are SEPARATE audiences (customer payloads also
 * carry `kind: 'customer'`), and a token from one audience never
 * verifies on the other's endpoints.
 */
const SCRYPT_KEYLEN = 64;

// Same session length as admin tokens (see ./auth.js).
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** The account shape the API returns — never salt/hash. */
function publicCustomer(record) {
  if (!record) return null;
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    createdAt: record.createdAt,
  };
}

class CustomersStore {
  constructor(dataFile) {
    this.dataFile = dataFile;
    this.tokenSecret = '';
    this.customers = [];
    this.load();
  }

  load() {
    if (fs.existsSync(this.dataFile)) {
      const parsed = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
      if (!parsed || !Array.isArray(parsed.customers) || !parsed.tokenSecret) {
        throw new Error(
          `Customers store at ${this.dataFile} does not have the expected { tokenSecret, customers } shape`
        );
      }
      this.tokenSecret = parsed.tokenSecret;
      this.customers = parsed.customers;
    } else {
      this.tokenSecret = crypto.randomBytes(32).toString('hex');
      this.customers = [];
      this.save();
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    const tmp = `${this.dataFile}.tmp`;
    fs.writeFileSync(
      tmp,
      JSON.stringify({ tokenSecret: this.tokenSecret, customers: this.customers }, null, 2)
    );
    fs.renameSync(tmp, this.dataFile);
  }

  count() {
    return this.customers.length;
  }

  findByEmail(email) {
    const wanted = normalizeEmail(email);
    if (!wanted) return null;
    return this.customers.find((c) => c.email === wanted) || null;
  }

  findById(id) {
    const cid = Number(id);
    if (!Number.isFinite(cid)) return null;
    return this.customers.find((c) => c.id === cid) || null;
  }

  /** Create an account. Callers validate input + uniqueness first. */
  create({ name, email, password }) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
    const id = this.customers.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    const record = {
      id,
      name: String(name || '').trim(),
      email: normalizeEmail(email),
      salt,
      hash,
      createdAt: new Date().toISOString(),
    };
    this.customers.push(record);
    this.save();
    return publicCustomer(record);
  }

  /**
   * Constant-time credential check. Returns the stored record on success,
   * null on any failure — unknown email and wrong password are
   * indistinguishable to the caller (no account enumeration).
   */
  verify(email, password) {
    const record = this.findByEmail(email);
    if (!record) {
      // Burn a comparable amount of work so unknown emails are not
      // trivially distinguishable by timing (same trick as accounts.js).
      crypto.scryptSync(String(password || ''), 'unknown-customer-salt', SCRYPT_KEYLEN);
      return null;
    }
    const candidate = crypto.scryptSync(String(password || ''), record.salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(record.hash, 'hex');
    const ok =
      candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
    return ok ? record : null;
  }

  // ----- Session tokens (customer audience — see the header note) -----------

  signingKey() {
    return `smokeshop-customer::${this.tokenSecret}`;
  }

  issueToken(customer) {
    const payload = { sub: String(customer.id), kind: 'customer', exp: Date.now() + TOKEN_TTL_MS };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.signingKey())
      .update(body)
      .digest('base64url');
    return { token: `${body}.${signature}`, expiresAt: new Date(payload.exp).toISOString() };
  }

  verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const [body, signature] = token.split('.');
    if (!body || !signature) return null;
    const expected = crypto
      .createHmac('sha256', this.signingKey())
      .update(body)
      .digest('base64url');
    if (!timingSafeStringEqual(signature, expected)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (payload.kind !== 'customer' || !payload.sub) return null;
      if (!payload.exp || payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }
}

/** Express middleware factory: rejects requests without a customer token. */
function requireCustomer(store) {
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    const payload = scheme === 'Bearer' ? store.verifyToken(token) : null;
    if (!payload) {
      return res.status(401).json({ error: 'Customer authentication required' });
    }
    req.customer = payload;
    return next();
  };
}

function createCustomersStore(dataDir) {
  return new CustomersStore(path.join(dataDir, 'customers.json'));
}

module.exports = {
  CustomersStore,
  createCustomersStore,
  publicCustomer,
  requireCustomer,
  normalizeEmail,
};
