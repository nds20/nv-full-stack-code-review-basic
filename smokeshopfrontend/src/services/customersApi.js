// Client for the Smoke Shop customer accounts API (see ../../server/).
//
// The customer token lives in localStorage, alongside the persisted user
// profile in AuthContext, so a signed-in shopper stays signed in across
// visits. (The ADMIN token in adminApi.js is sessionStorage-only on
// purpose — shoppers and admins get different treatment.)
//
// If the API is unreachable — e.g. a purely static deploy with no server
// behind it — these calls fail with a clear "accounts unavailable"
// message. Accounts are NEVER faked client-side: a signup that didn't
// reach the server did not create an account, and the UI says so.

const TOKEN_KEY = 'smokeshop_customer_token';

const UNAVAILABLE_MESSAGE =
  'Customer accounts are unavailable right now — the shop server could not be reached.';

export const getCustomerToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const setCustomerToken = (token) => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (private mode, quota) — the session simply
    // won't persist; sign-in itself still worked.
  }
};

export const clearCustomerToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
};

async function customerFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new Error(UNAVAILABLE_MESSAGE);
  }
  const data = await response.json().catch(() => null);
  if (data === null) {
    // Something answered, but not the API — e.g. static hosting
    // returning the app's index.html for an unknown path.
    throw new Error(UNAVAILABLE_MESSAGE);
  }
  if (!response.ok) {
    const err = new Error(data.error || `Request failed (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return data;
}

function postJson(path, body) {
  return customerFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Register a new customer account. Resolves to { token, expiresAt, customer }. */
export async function registerCustomer(name, email, password) {
  const data = await postJson('/api/customers/register', { name, email, password });
  if (data.token) setCustomerToken(data.token);
  return data;
}

/** Sign in. Resolves to { token, expiresAt, customer }. */
export async function loginCustomer(email, password) {
  const data = await postJson('/api/customers/login', { email, password });
  if (data.token) setCustomerToken(data.token);
  return data;
}

/** The signed-in customer's profile: { customer: { id, name, email, createdAt } }. */
export async function fetchCustomerMe() {
  const token = getCustomerToken();
  return customerFetch('/api/customers/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
