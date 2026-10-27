// Client for the Smoke Shop admin API (see ../../server/).
// The admin token lives in sessionStorage: it survives page reloads in the
// tab but is gone when the tab closes.

const TOKEN_KEY = 'smokeshop_admin_token';

export const getAdminToken = () => sessionStorage.getItem(TOKEN_KEY) || '';
export const setAdminToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearAdminToken = () => sessionStorage.removeItem(TOKEN_KEY);
export const isAdminLoggedIn = () => Boolean(getAdminToken());

async function adminFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data && data.error) message = data.error;
    } catch {
      // keep the generic message
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function adminLogin(username, password) {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Invalid credentials');
  }
  setAdminToken(data.token);
  return data;
}

export const fetchAdminProducts = () => adminFetch('/api/products');

export const createProduct = (body) =>
  adminFetch('/api/products', { method: 'POST', body });

export const updateProduct = (id, body) =>
  adminFetch(`/api/products/${id}`, { method: 'PUT', body });

export const deleteProduct = (id) =>
  adminFetch(`/api/products/${id}`, { method: 'DELETE' });

// ----- Admin orders (alerts) --------------------------------------------------
// The list endpoint returns { orders, newCount } — orders newest-first, and
// newCount is how many are still unacknowledged (status 'new').

export const fetchAdminOrders = () => adminFetch('/api/admin/orders');

export const fetchAdminOrder = (id) => adminFetch(`/api/admin/orders/${id}`);

export const markOrderSeen = (id) =>
  adminFetch(`/api/admin/orders/${id}/seen`, { method: 'PATCH' });

// ----- First-run admin setup ----------------------------------------------------

export async function fetchSetupStatus() {
  const response = await fetch('/api/admin/setup-status');
  if (!response.ok) throw new Error(`Setup status failed (${response.status})`);
  return response.json();
}

export async function setupAdmin(username, password) {
  const response = await fetch('/api/admin/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Could not create the admin account.');
  }
  // Setup returns a session token, just like login — the new admin is
  // signed in immediately.
  setAdminToken(data.token);
  return data;
}

/**
 * Build the request body for create/update. When a photo file is attached we
 * send multipart/form-data (numbers/arrays are stringified — the server
 * normalizes them); otherwise a plain JSON body.
 */
export function buildProductBody(fields, photoFile) {
  if (!photoFile) {
    return JSON.stringify({
      ...fields,
      price: fields.price === '' ? null : Number(fields.price),
      thc: fields.thc === '' ? null : Number(fields.thc),
      effects: fields.effects,
    });
  }
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    form.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value ?? ''));
  });
  form.append('photo', photoFile);
  return form;
}
