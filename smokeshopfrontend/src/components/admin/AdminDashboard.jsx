import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  buildProductBody,
  fetchAdminOrders,
  markOrderSeen,
  clearAdminToken,
} from '../../services/adminApi';
import AdminOrders from './AdminOrders';

// How often the dashboard checks for new orders while it is open.
const ORDERS_POLL_MS = 15000;

// Same category ids the storefront filter uses (ProductsPage.jsx).
const CATEGORIES = [
  { id: 'flower', name: 'Flower' },
  { id: 'vapes', name: 'Vapes' },
  { id: 'gummies', name: 'Gummies' },
  { id: 'pouches', name: 'Pouches' },
  { id: 'nic-vapes', name: 'Nicotine Vapes' },
];

const EMPTY_FORM = {
  name: '',
  subtitle: '',
  category: 'vapes',
  type: '',
  price: '',
  thc: '',
  strength: '',
  unit: '',
  effects: '',
  tile1: '#374151',
  tile2: '#111827',
};

function productToForm(p) {
  return {
    name: p.name || '',
    subtitle: p.subtitle || '',
    category: p.category || 'vapes',
    type: p.type || '',
    price: p.price == null ? '' : String(p.price),
    thc: p.thc == null ? '' : String(p.thc),
    strength: p.strength || '',
    unit: p.unit || '',
    effects: Array.isArray(p.effects) ? p.effects.join(', ') : '',
    tile1: (p.tile && p.tile[0]) || '#374151',
    tile2: (p.tile && p.tile[1]) || '#111827',
  };
}

export default function AdminDashboard({ onExit = () => {}, onUnauthorized = () => {} }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Orders + alerts state. The badge count is derived from the orders
  // themselves, so it updates the moment an order is marked seen.
  const [tab, setTab] = useState('products'); // 'products' | 'orders'
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState('');
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [notifPerm, setNotifPerm] = useState(
    () => ('Notification' in window ? Notification.permission : 'unsupported')
  );
  const newCount = orders.filter((o) => o.status === 'new').length;
  const knownNewIds = useRef(new Set());
  const firstOrdersLoad = useRef(true);

  const loadProducts = useCallback(async () => {
    try {
      const data = await fetchAdminProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(`Could not reach the product API (${err.message}). Is the server running?`);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const setField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError('');
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setPhoto(null);
  };

  const handleUnauthorized = (err) => {
    if (err && err.status === 401) {
      clearAdminToken();
      onUnauthorized();
      return true;
    }
    return false;
  };

  const loadOrders = useCallback(async () => {
    try {
      const data = await fetchAdminOrders();
      const list = data && Array.isArray(data.orders) ? data.orders : [];
      setOrders(list);
      setOrdersError('');

      // Browser notifications: only for orders that arrive AFTER the first
      // load (the initial backlog just seeds the known-ids set, so opening
      // the dashboard doesn't fire a storm of popups).
      const newOnes = list.filter((o) => o.status === 'new');
      if (firstOrdersLoad.current) {
        knownNewIds.current = new Set(newOnes.map((o) => o.id));
        firstOrdersLoad.current = false;
      } else {
        const fresh = newOnes.filter((o) => !knownNewIds.current.has(o.id));
        knownNewIds.current = new Set(newOnes.map((o) => o.id));
        if (fresh.length && 'Notification' in window && Notification.permission === 'granted') {
          fresh.forEach((o) => {
            try {
              new Notification(`New order #${o.id} — Smoke Shop`, {
                body: `${(o.customer && o.customer.fullName) || 'A customer'} · $${Number(o.total || 0).toFixed(2)}`,
              });
            } catch { /* notifications are best-effort only */ }
          });
        }
      }
    } catch (err) {
      if (!handleUnauthorized(err)) {
        setOrdersError(`Could not load orders (${err.message}). Is the server running?`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrdersRef = useRef(loadOrders);
  loadOrdersRef.current = loadOrders;

  // Poll for new orders while the dashboard is open, so the badge and the
  // Orders view stay live without a manual refresh.
  useEffect(() => {
    loadOrdersRef.current();
    const id = setInterval(() => loadOrdersRef.current(), ORDERS_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const handleMarkSeen = async (order) => {
    setBusyOrderId(order.id);
    try {
      const updated = await markOrderSeen(order.id);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    } catch (err) {
      if (!handleUnauthorized(err)) setOrdersError(err.message);
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setNotifPerm(result);
    } catch { /* permission prompt unavailable — badge still works */ }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!form.type.trim()) {
      setError('Type is required (e.g. Hybrid, Indica, Sativa, Nicotine, Flower).');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    const fields = {
      name: form.name.trim(),
      subtitle: form.subtitle.trim(),
      category: form.category,
      type: form.type.trim(),
      price: form.price,
      thc: form.thc,
      strength: form.strength.trim(),
      unit: form.unit.trim(),
      effects: form.effects.split(',').map((s) => s.trim()).filter(Boolean),
      tile: [form.tile1, form.tile2],
    };
    try {
      const body = buildProductBody(fields, photo);
      const saved = editingId
        ? await updateProduct(editingId, body)
        : await createProduct(body);
      setNotice(`Saved "${saved.name}" — it is live in the storefront now.`);
      resetForm();
      await loadProducts();
    } catch (err) {
      if (!handleUnauthorized(err)) setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (product) => {
    setEditingId(product.id);
    setForm(productToForm(product));
    setPhoto(null);
    setNotice('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}" from the storefront?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await deleteProduct(product.id);
      if (editingId === product.id) resetForm();
      setNotice(`Deleted "${product.name}".`);
      await loadProducts();
    } catch (err) {
      if (!handleUnauthorized(err)) setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    onExit();
  };

  return (
    <div className="am-page">
      <style>{css}</style>

      <header className="am-header">
        <div className="am-shell am-header-in">
          <h1 className="am-title">Store Admin</h1>
          <div className="am-header-actions">
            <button className="am-ghost" onClick={onExit}>View shop</button>
            <button className="am-ghost" onClick={handleLogout}>Log out</button>
          </div>
        </div>
      </header>

      <main className="am-shell">
        <div className="am-tabs" role="tablist" aria-label="Admin sections">
          <button
            role="tab"
            aria-selected={tab === 'products'}
            className={`am-tab${tab === 'products' ? ' am-tab--active' : ''}`}
            onClick={() => setTab('products')}
          >
            Products
          </button>
          <button
            role="tab"
            aria-selected={tab === 'orders'}
            className={`am-tab${tab === 'orders' ? ' am-tab--active' : ''}`}
            onClick={() => setTab('orders')}
          >
            Orders
            {newCount > 0 && <span className="am-badge">{newCount} new</span>}
          </button>
        </div>

        {error && <p className="am-error" role="alert">{error}</p>}
        {notice && <p className="am-notice" role="status">{notice}</p>}

        {tab === 'orders' && (
          <section className="am-card" aria-labelledby="am-orders-title">
            <h2 id="am-orders-title">
              Orders {orders.length > 0 ? `(${orders.length})` : ''}
              {newCount > 0 ? ` — ${newCount} new` : ''}
            </h2>
            <AdminOrders
              orders={orders}
              ordersError={ordersError}
              busyId={busyOrderId}
              onMarkSeen={handleMarkSeen}
              notificationPermission={notifPerm}
              onEnableNotifications={handleEnableNotifications}
            />
          </section>
        )}

        {tab === 'products' && (
        <>
        <section className="am-card" aria-labelledby="am-form-title">
          <h2 id="am-form-title">{editingId ? 'Edit product' : 'Add a product'}</h2>

          <div className="am-grid">
            <label className="am-field">
              <span>Name *</span>
              <input value={form.name} onChange={setField('name')} placeholder="e.g. Muha Meds Runtz 2G" />
            </label>
            <label className="am-field">
              <span>Subtitle</span>
              <input value={form.subtitle} onChange={setField('subtitle')} placeholder="Short description shown on the card" />
            </label>
            <label className="am-field">
              <span>Category</span>
              <select value={form.category} onChange={setField('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="am-field">
              <span>Type *</span>
              <input value={form.type} onChange={setField('type')} placeholder="Hybrid, Indica, Sativa, Nicotine, Flower..." list="am-types" />
              <datalist id="am-types">
                <option value="Hybrid" />
                <option value="Indica" />
                <option value="Sativa" />
                <option value="Indica/Hybrid" />
                <option value="Nicotine" />
                <option value="Flower" />
              </datalist>
            </label>
            <label className="am-field">
              <span>Price ($) — leave empty for "Price TBD"</span>
              <input type="number" min="0" step="0.01" value={form.price} onChange={setField('price')} placeholder="TBD" />
            </label>
            <label className="am-field">
              <span>THC % — leave empty if unknown</span>
              <input type="number" min="0" max="100" step="0.1" value={form.thc} onChange={setField('thc')} placeholder="Unknown" />
            </label>
            <label className="am-field">
              <span>Strength label — optional (defaults from THC, else "THC TBD")</span>
              <input value={form.strength} onChange={setField('strength')} placeholder="e.g. 12W" />
            </label>
            <label className="am-field">
              <span>Unit size</span>
              <input value={form.unit} onChange={setField('unit')} placeholder="e.g. 2g, 1ct, 3.5g" />
            </label>
            <label className="am-field am-field--wide">
              <span>Effects (comma separated)</span>
              <input value={form.effects} onChange={setField('effects')} placeholder="Relaxed, Happy" />
            </label>
            <label className="am-field">
              <span>Card colors (fallback tile)</span>
              <span className="am-colors">
                <input type="color" value={form.tile1} onChange={setField('tile1')} aria-label="Tile color 1" />
                <input type="color" value={form.tile2} onChange={setField('tile2')} aria-label="Tile color 2" />
              </span>
            </label>
            <label className="am-field">
              <span>Photo {editingId ? '(upload to replace)' : ''}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
              />
            </label>
          </div>

          <div className="am-form-actions">
            <button className="am-btn" onClick={handleSubmit} disabled={busy}>
              {busy ? 'Saving...' : editingId ? 'Save changes' : 'Add product'}
            </button>
            {editingId && (
              <button className="am-ghost" onClick={resetForm} disabled={busy}>Cancel edit</button>
            )}
          </div>
        </section>

        <section className="am-card" aria-labelledby="am-list-title">
          <h2 id="am-list-title">Current products ({products.length})</h2>
          <div className="am-list">
            {products.map((p) => (
              <article key={p.id} className="am-row">
                <span
                  className="am-thumb"
                  style={{ background: p.tile ? `linear-gradient(135deg, ${p.tile[0]}, ${p.tile[1]})` : '#222' }}
                >
                  {p.image && <img src={p.image} alt="" />}
                </span>
                <span className="am-row-main">
                  <strong>{p.name}</strong>
                  <span className="am-row-sub">
                    {p.category} · {p.type} · {p.price != null ? `$${p.price}` : 'Price TBD'} · {p.strength}
                  </span>
                </span>
                <span className="am-row-actions">
                  <button className="am-ghost" onClick={() => handleEdit(p)} disabled={busy}>Edit</button>
                  <button className="am-ghost am-danger" onClick={() => handleDelete(p)} disabled={busy}>Delete</button>
                </span>
              </article>
            ))}
            {products.length === 0 && <p className="am-empty">No products loaded yet.</p>}
          </div>
        </section>
        </>
        )}
      </main>
    </div>
  );
}

const css = `
.am-page {
  min-height: 100vh; background: #000; color: #fff; padding-bottom: 48px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
}
.am-shell { max-width: 960px; margin: 0 auto; padding: 0 20px; box-sizing: border-box; }
.am-header { border-bottom: 1px solid #2e2e2e; background: #0d0d0d; }
.am-header-in { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; padding-bottom: 16px; }
.am-title { margin: 0; font-size: 1.4rem; font-weight: 700; }
.am-header-actions { display: flex; gap: 8px; }
.am-card {
  background: #0d0d0d; border: 1px solid #2e2e2e; border-radius: 10px;
  padding: 22px; margin-top: 22px;
}
.am-card h2 { margin: 0 0 18px; font-size: 1.15rem; }
.am-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.am-field { display: flex; flex-direction: column; gap: 6px; font-size: .85rem; color: #bdbdbd; }
.am-field--wide { grid-column: 1 / -1; }
.am-field input, .am-field select {
  height: 44px; padding: 0 12px; box-sizing: border-box;
  font: inherit; font-size: 1rem; color: #fff;
  background: #000; border: 1px solid #4a4a4a; border-radius: 6px; outline: none;
}
.am-field input[type="file"] { padding: 9px 12px; height: auto; }
.am-field input[type="color"] { width: 52px; height: 36px; padding: 2px; }
.am-field input:focus, .am-field select:focus { border-color: #2f7a35; box-shadow: 0 0 0 3px rgba(47,122,53,.35); }
.am-colors { display: flex; gap: 10px; align-items: center; height: 44px; }
.am-form-actions { display: flex; gap: 10px; margin-top: 18px; align-items: center; }
.am-btn {
  height: 48px; padding: 0 22px;
  font: inherit; font-size: 1rem; font-weight: 600; color: #fff;
  background: #2b622f; border: 0; border-radius: 6px; cursor: pointer;
}
.am-btn:hover:not(:disabled) { background: #33733a; }
.am-btn:disabled { opacity: .7; cursor: default; }
.am-ghost {
  padding: 8px 14px; font: inherit; font-size: .95rem; color: #bdbdbd;
  background: none; border: 1px solid #4a4a4a; border-radius: 6px; cursor: pointer;
}
.am-ghost:hover:not(:disabled) { color: #fff; border-color: #8a8a8a; }
.am-ghost:disabled { opacity: .6; cursor: default; }
.am-danger:hover:not(:disabled) { color: #ff7b75; border-color: #d9534f; }
.am-error { margin: 18px 0 0; padding: 12px 14px; border: 1px solid #d9534f; border-radius: 6px; color: #ff7b75; background: rgba(217,83,79,.08); }
.am-notice { margin: 18px 0 0; padding: 12px 14px; border: 1px solid #2f7a35; border-radius: 6px; color: #9fe8a4; background: rgba(47,122,53,.12); }
.am-list { display: flex; flex-direction: column; gap: 10px; }
.am-row {
  display: flex; align-items: center; gap: 14px;
  border: 1px solid #2e2e2e; border-radius: 8px; padding: 10px 12px; background: #000;
}
.am-thumb { flex: 0 0 56px; width: 56px; height: 56px; border-radius: 6px; overflow: hidden; display: block; }
.am-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.am-row-main { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.am-row-sub { color: #bdbdbd; font-size: .85rem; }
.am-row-actions { display: flex; gap: 8px; }
.am-empty { color: #8a8a8a; }
.am-tabs { display: flex; gap: 8px; margin-top: 20px; }
.am-tab {
  padding: 10px 18px; font: inherit; font-size: 1rem; font-weight: 600; color: #bdbdbd;
  background: none; border: 1px solid #4a4a4a; border-radius: 999px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 8px;
}
.am-tab:hover { color: #fff; border-color: #8a8a8a; }
.am-tab--active { color: #fff; background: #2b622f; border-color: #2b622f; }
.am-badge {
  font-size: .75rem; font-weight: 800; line-height: 1; color: #000;
  background: #f5b921; border-radius: 999px; padding: 4px 8px;
}
@media (max-width: 640px) {
  .am-grid { grid-template-columns: 1fr; }
  .am-row { flex-wrap: wrap; }
}
`;
