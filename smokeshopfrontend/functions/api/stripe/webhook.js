// POST /api/stripe/webhook — Stripe's server-to-server payment events.
//
// The Stripe-Signature header is verified against the RAW request body
// with STRIPE_WEBHOOK_SECRET (see _lib/stripe.js) before anything is
// parsed or trusted; a bad signature is a 400 and changes nothing.
//
// Handled events (order payment lifecycle — the admin Orders tab shows
// the result):
//   checkout.session.completed        -> paymentStatus 'paid', recording
//                                        the payment intent id
//   checkout.session.expired          -> a 'pending' order returns to
//                                        'unpaid' (the buyer can retry);
//                                        a paid order is never downgraded
//   checkout.session.async_payment_failed -> 'payment_failed'
// Anything else is acknowledged (200) and ignored, so Stripe does not
// retry events we do not use. Handling is idempotent: Stripe retries
// deliveries, and re-applying an event leaves the order in the same
// state. Orders are matched by their stored Checkout Session id, with
// the session metadata's order_id as a fallback.

import { handle, json, fail } from '../_lib/http.js';
import {
  getOrder,
  updateOrderPayment,
  findOrderByStripeSessionId,
} from '../_lib/db.js';
import { stripeWebhookConfigured, verifyWebhookSignature } from '../_lib/stripe.js';

async function orderForSession(env, session) {
  const bySession = await findOrderByStripeSessionId(env, session.id);
  if (bySession) return bySession;
  const orderId = session.metadata && session.metadata.order_id
    ? session.metadata.order_id
    : session.client_reference_id;
  return orderId ? getOrder(env, orderId) : null;
}

export const onRequestPost = handle(async ({ request, env }) => {
  if (!stripeWebhookConfigured(env)) {
    fail(503, 'Stripe webhook is not configured (STRIPE_WEBHOOK_SECRET is not set).');
  }
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') || '';
  const valid = await verifyWebhookSignature(env.STRIPE_WEBHOOK_SECRET, rawBody, signature);
  if (!valid) fail(400, 'Invalid Stripe signature.');

  const event = JSON.parse(rawBody);
  const session = (event.data && event.data.object) || {};

  if (event.type === 'checkout.session.completed') {
    const order = await orderForSession(env, session);
    if (order && order.paymentStatus !== 'paid') {
      await updateOrderPayment(env, order.id, {
        paymentStatus: 'paid',
        stripeSessionId: session.id || order.stripeSessionId,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : order.stripePaymentIntentId,
      });
    }
  } else if (event.type === 'checkout.session.expired') {
    const order = await orderForSession(env, session);
    if (order && order.paymentStatus === 'pending') {
      await updateOrderPayment(env, order.id, { paymentStatus: 'unpaid' });
    }
  } else if (event.type === 'checkout.session.async_payment_failed') {
    const order = await orderForSession(env, session);
    if (order && order.paymentStatus !== 'paid') {
      await updateOrderPayment(env, order.id, { paymentStatus: 'payment_failed' });
    }
  }

  return json({ received: true });
});
