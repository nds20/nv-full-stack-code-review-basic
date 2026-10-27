// Admin authentication — the Cloudflare (WebCrypto) port of
// ../../server/src/auth.js.
//
// Same contract as the Node version:
//   - Credentials come from the environment only:
//       SMOKESHOP_ADMIN_USER / SMOKESHOP_ADMIN_PASSWORD
//       SMOKESHOP_ADMIN_SECRET (optional token-signing secret; if omitted,
//       the signing key is derived from the admin password, as in Node).
//   - A successful login returns a signed, expiring bearer token
//     (base64url payload + HMAC-SHA256 signature), valid for 8 hours.
//   - The built-in DEMO login (admin / admin123) exists only as a labeled
//     fallback while no real credentials exist anywhere; the login route
//     (not this module) enforces that precedence.
//
// Differences forced by the runtime: WebCrypto is async and has no scrypt,
// so stored-account password hashes use PBKDF2-SHA256 (see db.js). Hashes
// are therefore NOT interchangeable with the Node server's scrypt hashes —
// an admin account created against one runtime must be re-created (or env
// credentials used) on the other.

import { fail } from './http.js';

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const encoder = new TextEncoder();

export function adminCredentials(env) {
  return {
    user: env.SMOKESHOP_ADMIN_USER || '',
    password: env.SMOKESHOP_ADMIN_PASSWORD || '',
  };
}

/** True when both env-var credentials are set. */
export function isConfigured(env) {
  const { user, password } = adminCredentials(env);
  return Boolean(user && password);
}

function signingKey(env) {
  if (env.SMOKESHOP_ADMIN_SECRET) return env.SMOKESHOP_ADMIN_SECRET;
  const { password } = adminCredentials(env);
  return `smokeshop-admin::${password}`;
}

/** Constant-time string comparison over UTF-8 bytes (lengths leak, as in Node). */
export function timingSafeStringEqual(a, b) {
  const bufA = encoder.encode(String(a));
  const bufB = encoder.encode(String(b));
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i += 1) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

export function checkCredentials(env, username, password) {
  const expected = adminCredentials(env);
  if (!expected.user || !expected.password) return false;
  return (
    timingSafeStringEqual(username || '', expected.user) &&
    timingSafeStringEqual(password || '', expected.password)
  );
}

// ----- Demo fallback ---------------------------------------------------------
// DEMO ONLY — identical semantics to the Node server. Accepted only while
// no env credentials are set AND no stored account exists. It is a
// convenience for demos, never a production credential.
export const DUMMY_ADMIN_USER = 'admin';
export const DUMMY_ADMIN_PASSWORD = 'admin123';

export function checkDummyCredentials(username, password) {
  return (
    timingSafeStringEqual(username || '', DUMMY_ADMIN_USER) &&
    timingSafeStringEqual(password || '', DUMMY_ADMIN_PASSWORD)
  );
}

// ----- Tokens (HMAC-SHA256 via WebCrypto) ------------------------------------

export function base64urlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlDecode(text) {
  const b64 = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret, usages) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages
  );
}

export async function issueToken(env, username) {
  const payload = { sub: username, exp: Date.now() + TOKEN_TTL_MS };
  const body = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(signingKey(env), ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return {
    token: `${body}.${base64urlEncode(new Uint8Array(signature))}`,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export async function verifyToken(env, token) {
  if (!token || typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  let valid = false;
  try {
    const key = await hmacKey(signingKey(env), ['verify']);
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlDecode(signature),
      encoder.encode(body)
    );
  } catch {
    return null;
  }
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(body)));
    if (!payload.sub || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Gate for admin routes: rejects with 401 unless the request carries a
 * valid admin bearer token. Returns the token payload on success.
 * (The port of the Node server's requireAdmin middleware.)
 */
export async function requireAdmin(context) {
  const header = context.request.headers.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  const payload = scheme === 'Bearer' ? await verifyToken(context.env, token) : null;
  if (!payload) fail(401, 'Admin authentication required');
  return payload;
}

// ----- Stored-account password hashing (PBKDF2-SHA256) -----------------------
// scrypt is not available in the Workers runtime, so stored accounts use
// PBKDF2 with a per-account random salt, mirroring accounts.js in shape:
// { salt, hash } (both base64 here, hex in Node) — never plaintext.

export const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_BITS = 256;

export function base64Encode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64Decode(text) {
  const binary = atob(String(text));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function hashPassword(password, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    PBKDF2_KEY_BITS
  );
  return new Uint8Array(bits);
}

/** Create a fresh { salt, hash } pair for a new stored admin account. */
export async function newPasswordRecord(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  return { salt: base64Encode(salt), hash: base64Encode(hash) };
}

/** Constant-time check of a password against a stored { salt, hash } pair. */
export async function verifyPassword(password, saltB64, hashB64) {
  const candidate = await hashPassword(password || '', base64Decode(saltB64));
  return timingSafeStringEqual(base64Encode(candidate), String(hashB64));
}

// ----- Customer session tokens -------------------------------------------------
// Shoppers are a SEPARATE audience from admins. Customer token payloads
// carry `kind: 'customer'`, and the HMAC key is derived from a
// per-database random secret (see db.js: getCustomerTokenSecret) — never
// from the admin signing key — so an admin token cannot verify as a
// customer token or the other way around, on either endpoint set.
// Same 8-hour TTL and token format as admin tokens.

function customerSigningKey(secret) {
  return `smokeshop-customer::${secret}`;
}

export async function issueCustomerToken(customerId, secret) {
  const payload = { sub: String(customerId), kind: 'customer', exp: Date.now() + TOKEN_TTL_MS };
  const body = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(customerSigningKey(secret), ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return {
    token: `${body}.${base64urlEncode(new Uint8Array(signature))}`,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export async function verifyCustomerToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  let valid = false;
  try {
    const key = await hmacKey(customerSigningKey(secret), ['verify']);
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlDecode(signature),
      encoder.encode(body)
    );
  } catch {
    return null;
  }
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(body)));
    if (payload.kind !== 'customer' || !payload.sub) return null;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
