// POST /api/admin/login — admin sign-in.
//
// Precedence, identical to the Node server: (1) env-var credentials,
// (2) a stored account created via setup, (3) the built-in DEMO login —
// only while neither of the above exists. The first match wins; the
// response says which one matched (authSource) so the UI can warn when
// the demo login was used.

import { handle, json } from '../_lib/http.js';
import {
  isConfigured,
  checkCredentials,
  checkDummyCredentials,
  issueToken,
} from '../_lib/auth.js';
import { hasAccounts, verifyAccount } from '../_lib/db.js';

export const onRequestPost = handle(async ({ request, env }) => {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body || {};

  const envReady = isConfigured(env);
  const accountsExist = await hasAccounts(env);
  const dummyEnabled = !envReady && !accountsExist;

  let authSource = null;
  if (envReady && checkCredentials(env, username, password)) {
    authSource = 'env';
  } else if (await verifyAccount(env, username, password)) {
    authSource = 'account';
  } else if (dummyEnabled && checkDummyCredentials(username, password)) {
    authSource = 'demo';
  }

  if (!authSource) return json({ error: 'Invalid credentials' }, 401);
  const token = await issueToken(env, String(username).trim());
  return json({ ...token, authSource });
});
