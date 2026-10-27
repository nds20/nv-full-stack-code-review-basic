// GET /api/admin/setup-status — does first-run setup apply?
// Same response shape as the Node server; the admin login screen uses it
// to decide whether to offer "Create admin account" and the demo banner.

import { handle, json } from '../_lib/http.js';
import { isConfigured } from '../_lib/auth.js';
import { hasAccounts } from '../_lib/db.js';

export const onRequestGet = handle(async ({ env }) => {
  const accountsExist = await hasAccounts(env);
  const envReady = isConfigured(env);
  return json({
    setupRequired: !accountsExist,
    envConfigured: envReady,
    dummyActive: !envReady && !accountsExist,
  });
});
