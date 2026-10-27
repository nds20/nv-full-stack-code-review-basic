// Small HTTP helpers shared by the Smoke Shop Pages Functions API.
//
// Everything here is Web-standard (Request/Response) — no Node APIs — so
// the same code runs on Cloudflare's Workers runtime. Behaviour mirrors
// the Node/Express server in ../../server/: JSON bodies everywhere, and
// errors shaped as { error: "<message>" } with an HTTP status.

/** Serialize `data` as a JSON response. */
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

/** An error carrying an HTTP status — the port of the Node server's err.status. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Throw an HttpError (caught by `handle` and turned into a JSON response). */
export function fail(status, message) {
  throw new HttpError(status, message);
}

/**
 * Wrap a route handler so thrown HttpErrors (and unexpected errors) become
 * { error } JSON responses, exactly like the Express error middleware in
 * server/index.js.
 */
export function handle(fn) {
  return async (context) => {
    try {
      return await fn(context);
    } catch (err) {
      const status = err && err.status ? err.status : 500;
      if (status >= 500) console.error(err);
      return json({ error: (err && err.message) || 'Server error' }, status);
    }
  };
}

/** Round to 2 decimals the same way the Node server (and storefront) does. */
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Same slug rules as server/index.js (used for uploaded photo names). */
export function slugify(text) {
  return (
    String(text || 'product')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'product'
  );
}

/** Parse a route param as a numeric id (Node's store does Number(id)). */
export function numericId(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Constant-time comparison of two hex strings (used for webhook
 * signatures). Lengths leak, as with the byte compare in auth.js.
 */
export function timingSafeHexEqual(a, b) {
  const sa = String(a);
  const sb = String(b);
  if (sa.length !== sb.length) return false;
  let diff = 0;
  for (let i = 0; i < sa.length; i += 1) diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  return diff === 0;
}
