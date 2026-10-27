// GET /api/orders/:id/status?token=<accessToken> — the buyer's narrow
// window into their own order after returning from Stripe (or while the
// confirmation page waits for the webhook). Requires the per-order access
// token issued at order creation: an order id alone (small, guessable
// integers) reveals nothing. Returns only status fields — no customer
// details, no items.

import { handle, json, fail, numericId } from '../../_lib/http.js';
import { getOrder } from '../../_lib/db.js';
import { timingSafeStringEqual } from '../../_lib/auth.js';

export const onRequestGet = handle(async ({ request, env, params }) => {
  const id = numericId(params.id);
  const order = id === null ? null : await getOrder(env, id);
  if (!order) fail(404, 'Order not found');

  const token = new URL(request.url).searchParams.get('token') || '';
  if (!order.accessToken || !timingSafeStringEqual(token, order.accessToken)) {
    fail(403, 'A valid order access token is required to read this order.');
  }
  return json({
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: order.total,
  });
});
