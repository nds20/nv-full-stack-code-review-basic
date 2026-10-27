// POST /api/customers/login — customer sign-in.
//
// One generic 401 for unknown email and wrong password alike, exactly
// like the Node server: the response never reveals whether an account
// exists for the email.

import { handle, json } from '../_lib/http.js';
import { issueCustomerToken } from '../_lib/auth.js';
import { verifyCustomerCredentials, getCustomerTokenSecret } from '../_lib/db.js';

export const onRequestPost = handle(async ({ request, env }) => {
  const body = await request.json().catch(() => ({}));
  const { email, password } = body || {};
  const customer = await verifyCustomerCredentials(env, email, password);
  if (!customer) return json({ error: 'Invalid credentials' }, 401);
  const token = await issueCustomerToken(customer.id, await getCustomerTokenSecret(env));
  return json({ ...token, customer });
});
