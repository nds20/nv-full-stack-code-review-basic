// PATCH /api/admin/orders/:id/seen — acknowledge an order
// (status 'new' -> 'seen', stamping seenAt). Idempotent, like the Node
// server; this is what the admin page's "Mark seen" button calls.

import { handle, json, fail } from '../../../_lib/http.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { markOrderSeen } from '../../../_lib/db.js';

export const onRequestPatch = handle(async (context) => {
  await requireAdmin(context);
  const order = await markOrderSeen(context.env, context.params.id);
  if (!order) fail(404, 'Order not found');
  return json(order);
});
