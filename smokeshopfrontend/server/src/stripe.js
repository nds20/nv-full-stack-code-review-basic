'use strict';

// Stripe integration for the Node server — the counterpart of
// functions/api/_lib/stripe.js (same contract, node:crypto instead of
// WebCrypto). No Stripe SDK: Checkout Sessions are created with a plain
// fetch to Stripe's REST API, and webhook signatures are verified by hand
// (HMAC-SHA256 over "<timestamp>.<raw body>", Stripe's documented
// scheme).
//
// Configuration (environment variables — never code):
//   STRIPE_SECRET_KEY      sk_test_... or sk_live_... — enables payments.
//                          When unset, the shop runs exactly as before:
//                          /api/payments/config reports stripeEnabled:
//                          false and the checkout-session endpoint
//                          answers 503.
//   STRIPE_WEBHOOK_SECRET  whsec_... — verifies /api/stripe/webhook.
//   STRIPE_API_BASE        Optional override of https://api.stripe.com
//                          (used by tests; not needed in production).

const crypto = require('crypto');

const STRIPE_API_BASE_DEFAULT = 'https://api.stripe.com';

// How long a webhook signature timestamp may drift from "now" before the
// delivery is rejected — Stripe's own default tolerance is 5 minutes.
const WEBHOOK_TOLERANCE_SECONDS = 300;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function stripeConfigured(env = process.env) {
  return Boolean(env.STRIPE_SECRET_KEY);
}

function stripeWebhookConfigured(env = process.env) {
  return Boolean(env.STRIPE_WEBHOOK_SECRET);
}

const toCents = (dollars) => Math.round(Number(dollars) * 100);

/**
 * Create a Stripe Checkout Session for a stored order. Line items are
 * built ONLY from the order's server-computed items/totals — the client
 * never names amounts. The stored total is reproduced exactly: item line
 * totals plus one "Sales tax" line for the stored tax amount.
 *
 * Returns { id, url } — send the customer to `url` to pay.
 */
async function createCheckoutSession(order, origin, env = process.env) {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) {
    throw httpError(
      503,
      'Card payments are not configured on this server (STRIPE_SECRET_KEY is not set).'
    );
  }
  const base = env.STRIPE_API_BASE || STRIPE_API_BASE_DEFAULT;
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('client_reference_id', String(order.id));
  form.set('success_url', `${origin}/?payment=return&order=${order.id}&token=${order.accessToken}`);
  form.set('cancel_url', `${origin}/`);
  form.set('metadata[order_id]', String(order.id));
  form.set('payment_intent_data[metadata][order_id]', String(order.id));

  order.items.forEach((item, i) => {
    form.set(`line_items[${i}][quantity]`, String(item.qty));
    form.set(`line_items[${i}][price_data][currency]`, 'usd');
    form.set(`line_items[${i}][price_data][unit_amount]`, String(toCents(item.unitPrice)));
    form.set(`line_items[${i}][price_data][product_data][name]`, item.name);
  });
  if (Number(order.tax) > 0) {
    const i = order.items.length;
    form.set(`line_items[${i}][quantity]`, '1');
    form.set(`line_items[${i}][price_data][currency]`, 'usd');
    form.set(`line_items[${i}][price_data][unit_amount]`, String(toCents(order.tax)));
    form.set(`line_items[${i}][price_data][product_data][name]`, 'Sales tax');
  }

  let response;
  try {
    response = await fetch(`${base}/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
  } catch (err) {
    throw httpError(502, `Could not reach Stripe to start checkout (${err.message}).`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id || !data.url) {
    const message = (data.error && data.error.message) || `Stripe returned HTTP ${response.status}`;
    throw httpError(502, `Stripe could not create a checkout session: ${message}`);
  }
  return { id: data.id, url: data.url };
}

/**
 * Verify a Stripe webhook `Stripe-Signature` header against the RAW body
 * (verification is over the exact bytes Stripe sent — never re-serialize
 * parsed JSON). Header shape: t=<unix>,v1=<hex>[,v1=<hex>...]; the signed
 * payload is "<t>.<body>". Returns true/false, never throws.
 */
function verifyWebhookSignature(secret, rawBody, signatureHeader, nowSeconds) {
  if (!secret || !signatureHeader) return false;
  let timestamp = null;
  const signatures = [];
  for (const part of String(signatureHeader).split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name === 't') timestamp = Number(value);
    if (name === 'v1' && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return false;
  const now = typeof nowSeconds === 'number' ? nowSeconds : Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const bodyText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${bodyText}`, 'utf8')
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  return signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, 'utf8');
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}

/** A random per-order access token (hex) — see ordersStore.js. */
function newOrderAccessToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  STRIPE_API_BASE_DEFAULT,
  WEBHOOK_TOLERANCE_SECONDS,
  stripeConfigured,
  stripeWebhookConfigured,
  createCheckoutSession,
  verifyWebhookSignature,
  newOrderAccessToken,
};
