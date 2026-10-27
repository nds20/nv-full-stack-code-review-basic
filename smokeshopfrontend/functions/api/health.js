// GET /api/health — liveness check, same as the Node server.
import { json } from './_lib/http.js';

export async function onRequestGet() {
  return json({ ok: true });
}
