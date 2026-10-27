// GET /api/payments/config — public capability probe for the storefront:
// is Stripe Checkout available on this deployment? The storefront uses it
// to decide whether checkout offers "Pay with card" (Stripe-hosted) or
// the classic demo card form. Reveals nothing sensitive — just whether a
// secret key is configured on the server.

import { handle, json } from '../_lib/http.js';
import { stripeConfigured } from '../_lib/stripe.js';

export const onRequestGet = handle(async ({ env }) =>
  json({ stripeEnabled: stripeConfigured(env) })
);
