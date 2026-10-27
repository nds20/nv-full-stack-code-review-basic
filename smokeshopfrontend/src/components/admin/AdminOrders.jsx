import React from 'react';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

function formatWhen(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

/**
 * Orders view for the admin dashboard. Purely presentational — the
 * dashboard owns the data (it polls GET /api/admin/orders) and the
 * mark-seen action; this renders the list newest-first, which is the
 * order the API already returns.
 */
export default function AdminOrders({
  orders = [],
  ordersError = '',
  busyId = null,
  onMarkSeen = () => {},
  notificationPermission = 'unsupported',
  onEnableNotifications = () => {},
}) {
  return (
    <div>
      <style>{css}</style>

      {notificationPermission === 'default' && (
        <div className="ao-notify">
          <span>Get a browser notification when a new order arrives while this page is open.</span>
          <button className="ao-ghost" onClick={onEnableNotifications}>Enable notifications</button>
        </div>
      )}
      {notificationPermission === 'granted' && (
        <p className="ao-notify-on">🔔 Browser notifications are on — new orders will pop up here while this page is open.</p>
      )}

      {ordersError && <p className="ao-error" role="alert">{ordersError}</p>}

      {orders.length === 0 && !ordersError && (
        <p className="ao-empty">No orders yet. New orders placed in the shop will appear here automatically.</p>
      )}

      <div className="ao-list">
        {orders.map((order) => {
          const isNew = order.status === 'new';
          const customer = order.customer || {};
          return (
            <article key={order.id} className={`ao-card${isNew ? ' ao-card--new' : ''}`}>
              <div className="ao-card-head">
                <strong>Order #{order.id}</strong>
                <span className={`ao-pill${isNew ? ' ao-pill--new' : ''}`}>
                  {isNew ? '● New' : 'Seen'}
                </span>
                <span className="ao-when">{formatWhen(order.createdAt)}</span>
                {isNew && (
                  <button
                    className="ao-btn"
                    onClick={() => onMarkSeen(order)}
                    disabled={busyId === order.id}
                  >
                    {busyId === order.id ? 'Marking…' : 'Mark seen'}
                  </button>
                )}
              </div>

              <div className="ao-cols">
                <div className="ao-customer">
                  <div className="ao-name">{customer.fullName || '—'}</div>
                  {customer.phone && <div>{customer.phone}</div>}
                  {customer.address && (
                    <div>
                      {customer.address}
                      {customer.city ? `, ${customer.city}` : ''}
                      {customer.zip ? ` ${customer.zip}` : ''}
                    </div>
                  )}
                  {customer.notes && <div className="ao-notes">Note: {customer.notes}</div>}
                  {order.payment && order.payment.last4 && (
                    <div className="ao-pay">Card ending {order.payment.last4}</div>
                  )}
                </div>

                <div className="ao-items">
                  {(order.items || []).map((item, i) => (
                    <div key={i} className="ao-line">
                      <span>{item.name} × {item.qty}</span>
                      <span>{money(item.lineTotal)}</span>
                    </div>
                  ))}
                  <div className="ao-line ao-sub">
                    <span>Subtotal</span>
                    <span>{money(order.subtotal)}</span>
                  </div>
                  <div className="ao-line ao-sub">
                    <span>Tax</span>
                    <span>{money(order.tax)}</span>
                  </div>
                  <div className="ao-line ao-total">
                    <span>Total</span>
                    <span>{money(order.total)}</span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

const css = `
.ao-notify {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  border: 1px solid #2e2e2e; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;
  color: #bdbdbd; font-size: .92rem; background: #000;
}
.ao-notify-on { color: #9fe8a4; font-size: .92rem; margin: 0 0 16px; }
.ao-error { padding: 12px 14px; border: 1px solid #d9534f; border-radius: 6px; color: #ff7b75; background: rgba(217,83,79,.08); }
.ao-empty { color: #8a8a8a; }
.ao-list { display: flex; flex-direction: column; gap: 12px; }
.ao-card { border: 1px solid #2e2e2e; border-radius: 8px; padding: 14px 16px; background: #000; }
.ao-card--new { border-color: #2f7a35; box-shadow: 0 0 0 1px #2f7a35 inset; }
.ao-card-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.ao-pill { font-size: .78rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; border: 1px solid #4a4a4a; color: #bdbdbd; }
.ao-pill--new { border-color: #2f7a35; color: #9fe8a4; background: rgba(47,122,53,.15); }
.ao-when { color: #8a8a8a; font-size: .85rem; }
.ao-btn {
  margin-left: auto; padding: 7px 14px; font: inherit; font-size: .9rem; font-weight: 600;
  color: #fff; background: #2b622f; border: 0; border-radius: 6px; cursor: pointer;
}
.ao-btn:hover:not(:disabled) { background: #33733a; }
.ao-btn:disabled { opacity: .7; cursor: default; }
.ao-ghost {
  padding: 7px 12px; font: inherit; font-size: .9rem; color: #bdbdbd;
  background: none; border: 1px solid #4a4a4a; border-radius: 6px; cursor: pointer; white-space: nowrap;
}
.ao-ghost:hover { color: #fff; border-color: #8a8a8a; }
.ao-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.ao-customer { color: #d6d6d6; font-size: .92rem; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ao-name { font-weight: 700; color: #fff; }
.ao-notes { color: #bdbdbd; font-style: italic; }
.ao-pay { color: #8a8a8a; }
.ao-items { display: flex; flex-direction: column; gap: 4px; font-size: .92rem; }
.ao-line { display: flex; justify-content: space-between; gap: 12px; }
.ao-sub { color: #bdbdbd; border-top: 1px solid #2e2e2e; padding-top: 5px; }
.ao-sub + .ao-sub { border-top: 0; padding-top: 0; }
.ao-total { font-weight: 700; border-top: 1px solid #2e2e2e; padding-top: 5px; }
@media (max-width: 640px) { .ao-cols { grid-template-columns: 1fr; } .ao-btn { margin-left: 0; } }
`;
