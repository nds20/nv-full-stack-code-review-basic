// POST /api/orders — place an order (public; this is the storefront
// checkout). Validation (including the Price-TBD block) and totals happen
// here, never on the client's say-so — same as the Node server.

import { handle, json } from './_lib/http.js';
import { getProduct, createOrder } from './_lib/db.js';
import { normalizeOrder } from './_lib/validate.js';

export const onRequestPost = handle(async ({ request, env }) => {
  const body = await request.json().catch(() => ({}));
  const data = await normalizeOrder(body || {}, (id) => getProduct(env, id));
  const order = await createOrder(env, data);
  return json(order, 201);
});
