// GET /api/admin/orders — the admin order inbox that powers the admin
// page's order alerts: orders newest-first plus the count still in
// status 'new' (the dashboard badges that number and polls this route).

import { handle, json } from '../_lib/http.js';
import { requireAdmin } from '../_lib/auth.js';
import { listOrders, countNewOrders } from '../_lib/db.js';

export const onRequestGet = handle(async (context) => {
  await requireAdmin(context);
  return json({
    orders: await listOrders(context.env),
    newCount: await countNewOrders(context.env),
  });
});
