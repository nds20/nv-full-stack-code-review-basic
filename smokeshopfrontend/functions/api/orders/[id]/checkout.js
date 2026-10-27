// POST /api/orders/:id/checkout — start a Stripe Checkout payment for an
// already-placed order and return the hosted checkout URL.
//
// Authorization: the order's per-order access token (issued in the
// POST /api/orders response to the buyer) must be presented in the JSON
// body as { accessToken }. That keeps strangers from minting payment
// sessions for other people's orders, without requiring an account.
//
// Amounts come only from the stored, server-computed order — the client
// cannot influence them. When STRIPE_SECRET_KEY is not configured this
// answers 503 and the shop keeps using the demo checkout, unchanged.

import { handle, json, fail, numericId } from '../../_lib/http.js';
import { getOrder, updateOrderPayment } from '../../_lib/db.js';
import { timingSafeStringEqual } from '../../_lib/auth.js';
import { stripeConfigured, createCheckoutSession } from '../../_lib/stripe.js';

export const onRequestPost = handle(async ({ request, env, params }) => {
  if (!stripeConfigured(env)) {
    fail(
      503,
      'Card payments are not configured yet (STRIPE_SECRET_KEY is not set). The order is saved; checkout continues in demo mode.'
    );
  }
  const id = numericId(params.id);
  const order = id === null ? null : await getOrder(env, id);
  if (!order) fail(404, 'Order not found');

  const body = await request.json().catch(() => ({}));
  const token = body && body.accessToken ? String(body.accessToken) : '';
  if (!order.accessToken || !timingSafeStringEqual(token, order.accessToken)) {
    fail(403, 'A valid order access token is required to start payment for this order.');
  }
  if (order.paymentStatus === 'paid') fail(409, 'This order has already been paid.');

  const origin = new URL(request.url).origin;
  const session = await createCheckoutSession(env, order, origin);
  await updateOrderPayment(env, order.id, {
    paymentStatus: 'pending',
    stripeSessionId: session.id,
  });
  return json({ url: session.url, sessionId: session.id });
});
