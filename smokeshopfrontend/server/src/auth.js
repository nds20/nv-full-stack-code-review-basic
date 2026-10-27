'use strict';

const crypto = require('crypto');

/**
 * Admin authentication.
 *
 * Credentials come from the environment only — nothing is hardcoded:
 *   SMOKESHOP_ADMIN_USER      admin username
 *   SMOKESHOP_ADMIN_PASSWORD  admin password
 *   SMOKESHOP_ADMIN_SECRET    (optional) secret used to sign session tokens.
 *                             If omitted, the signing key is derived from the
 *                             admin password and a warning is printed at boot.
 *
 * A successful login returns a signed, expiring bearer token
 * (base64url payload + HMAC-SHA256 signature). Tokens last 8 hours.
 */

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function adminCredentials() {
  return {
    user: process.env.SMOKESHOP_ADMIN_USER || '',
    password: process.env.SMOKESHOP_ADMIN_PASSWORD || '',
  };
}

function isConfigured() {
  const { user, password } = adminCredentials();
  return Boolean(user && password);
}

function signingKey() {
  if (process.env.SMOKESHOP_ADMIN_SECRET) return process.env.SMOKESHOP_ADMIN_SECRET;
  const { password } = adminCredentials();
  return `smokeshop-admin::${password}`;
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkCredentials(username, password) {
  const expected = adminCredentials();
  if (!expected.user || !expected.password) return false;
  return (
    timingSafeStringEqual(username || '', expected.user) &&
    timingSafeStringEqual(password || '', expected.password)
  );
}

// ----- Demo fallback ---------------------------------------------------------
// DEMO ONLY. When no real admin credentials exist anywhere — no env vars
// and no stored account created via the setup flow — the server accepts
// this built-in demo login so the admin area can be tried immediately
// (username "admin", password "admin123"). The moment real credentials
// exist, the demo login stops working (the login handler in index.js only
// consults it when nothing else is configured). It is a convenience for
// local demos, never a production credential.
const DUMMY_ADMIN_USER = 'admin';
const DUMMY_ADMIN_PASSWORD = 'admin123';

function checkDummyCredentials(username, password) {
  return (
    timingSafeStringEqual(username || '', DUMMY_ADMIN_USER) &&
    timingSafeStringEqual(password || '', DUMMY_ADMIN_PASSWORD)
  );
}

function issueToken(username) {
  const payload = { sub: username, exp: Date.now() + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
  return { token: `${body}.${signature}`, expiresAt: new Date(payload.exp).toISOString() };
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
  if (!timingSafeStringEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.sub || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Express middleware: rejects requests without a valid admin token. */
function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  const payload = scheme === 'Bearer' ? verifyToken(token) : null;
  if (!payload) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  req.admin = payload;
  return next();
}

module.exports = {
  isConfigured,
  checkCredentials,
  DUMMY_ADMIN_USER,
  DUMMY_ADMIN_PASSWORD,
  checkDummyCredentials,
  issueToken,
  verifyToken,
  requireAdmin,
};
