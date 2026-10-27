// Public orders client — posts a placed order to the Smoke Shop API
// (see ../../server/). Used by App.jsx when checkout completes.
//
// The static hosting (Cloudflare) has no API behind it, so submission can
// legitimately fail. In that case the order is kept in a local "pending"
// list in localStorage and checkout continues exactly as before — the
// customer always gets their confirmation; the order just isn't sent.

const PENDING_KEY = 'smokeshop_pending_orders';

export async function submitOrder(order) {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || `Order submission failed (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return data;
}

export function queuePendingOrder(order) {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const pending = raw ? JSON.parse(raw) : [];
    pending.push({ queuedAt: new Date().toISOString(), order });
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Storage unavailable (private mode, quota) — nothing more we can do;
    // checkout must still complete for the customer.
  }
}

export function getPendingOrders() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
