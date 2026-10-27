// POST /api/admin/setup — create the FIRST admin account (first-run
// setup). Once an account exists this responds 409, exactly like the Node
// server. Creating a real account disables the demo login from that
// moment on (see login.js precedence).

import { handle, json } from '../_lib/http.js';
import { issueToken } from '../_lib/auth.js';
import { hasAccounts, createAccount } from '../_lib/db.js';

export const onRequestPost = handle(async ({ request, env }) => {
  if (await hasAccounts(env)) {
    return json(
      { error: 'An admin account already exists. Setup is only for creating the first account.' },
      409
    );
  }
  const body = await request.json().catch(() => ({}));
  const { username, password } = body || {};
  const name = String(username || '').trim();
  if (name.length < 3) {
    return json({ error: 'Username must be at least 3 characters.' }, 400);
  }
  if (typeof password !== 'string' || password.length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, 400);
  }
  const account = await createAccount(env, name, password);
  const token = await issueToken(env, account.username);
  return json({ ...token, authSource: 'account' }, 201);
});
