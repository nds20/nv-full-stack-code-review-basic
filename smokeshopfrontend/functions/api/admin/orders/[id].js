// GET /api/admin/orders/:id — one order, admin only.

import { handle, json, fail } from '../../_lib/http.js';
import { requireAdmin } from '../../_lib/auth.js';
import { getOrder } from '../../_lib/db.js';

export const onRequestGet = handle(async (context) => {
  await requireAdmin(context);
  const order = await getOrder(context.env, context.params.id);
  if (!order) fail(404, 'Order not found');
  return json(order);
});
