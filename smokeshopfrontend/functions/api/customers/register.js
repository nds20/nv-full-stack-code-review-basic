// POST /api/customers/register — create a REAL customer account.
//
// Mirrors the Node server (server/index.js): name, email and a password
// of at least 8 characters; emails are unique case-insensitively
// (duplicates get a 409). The response carries the new customer's id —
// nothing is seeded, so the first person to register is customer 1 —
// plus a customer session token (see _lib/auth.js: a separate audience
// from admin tokens).

import { handle, json } from '../_lib/http.js';
import { issueCustomerToken } from '../_lib/auth.js';
import { findCustomerByEmail, createCustomer, getCustomerTokenSecret } from '../_lib/db.js';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost = handle(async ({ request, env }) => {
  const body = await request.json().catch(() => ({}));
  const { name, email, password } = body || {};
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanName) {
    return json({ error: 'Name is required.' }, 400);
  }
  if (!EMAIL_SHAPE.test(cleanEmail)) {
    return json({ error: 'Enter a valid email address.' }, 400);
  }
  if (typeof password !== 'string' || password.length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, 400);
  }
  if (await findCustomerByEmail(env, cleanEmail)) {
    return json({ error: 'An account with that email already exists.' }, 409);
  }
  const customer = await createCustomer(env, { name: cleanName, email: cleanEmail, password });
  const token = await issueCustomerToken(customer.id, await getCustomerTokenSecret(env));
  return json({ ...token, customer }, 201);
});
