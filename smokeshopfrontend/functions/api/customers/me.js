// GET /api/customers/me — the signed-in customer's profile.
//
// Requires a CUSTOMER bearer token: admin tokens are a different
// audience (different signing key plus a `kind: 'customer'` claim, see
// _lib/auth.js) and are rejected here, just as customer tokens are
// rejected on the admin routes.

import { handle, json } from '../_lib/http.js';
import { verifyCustomerToken } from '../_lib/auth.js';
import { getCustomerById, getCustomerTokenSecret } from '../_lib/db.js';

export const onRequestGet = handle(async ({ request, env }) => {
  const header = request.headers.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  const payload =
    scheme === 'Bearer'
      ? await verifyCustomerToken(token, await getCustomerTokenSecret(env))
      : null;
  if (!payload) return json({ error: 'Customer authentication required' }, 401);
  const customer = await getCustomerById(env, payload.sub);
  if (!customer) return json({ error: 'Customer authentication required' }, 401);
  return json({ customer });
});
