import React, { createContext, useState, useCallback, useEffect } from 'react';
import {
  registerCustomer,
  loginCustomer,
  fetchCustomerMe,
  getCustomerToken,
  clearCustomerToken,
} from '../services/customersApi';

export const AuthContext = createContext();

// The user object the rest of the app has always consumed, now built
// from a REAL customer profile returned by the API (services/customersApi)
// instead of being invented client-side. `subscription` is kept because
// the shape predates real accounts; no plan data comes from the server.
function toUserProfile(customer) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    identifier: customer.email,
    subscription: { plan: 'free', active: true },
    createdAt: customer.createdAt,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [ageVerified, setAgeVerified] = useState(() => {
    return localStorage.getItem('ageVerified') === 'true';
  });
  const [zip, setZip] = useState(() => {
    return localStorage.getItem('zip') || '';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  useEffect(() => {
    localStorage.setItem('ageVerified', ageVerified);
  }, [ageVerified]);

  useEffect(() => {
    if (zip) localStorage.setItem('zip', zip);
  }, [zip]);

  const verifyAge = useCallback(async (zipCode) => {
    setLoading(true);
    setError('');
    try {
      // TODO: Call backend API to verify ZIP code compliance
      // const response = await fetch('/api/auth/verify-age', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ zip: zipCode })
      // });
      // if (!response.ok) throw new Error('ZIP code not allowed');
      
      setAgeVerified(true);
      setZip(zipCode);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Real sign-in against POST /api/customers/login. Throws on failure
  // (wrong credentials, or the API being unreachable) so callers can
  // show the message and stay on the form — the old demo version
  // "signed in" any input without checking anything.
  const login = useCallback(async (identifier, password) => {
    setLoading(true);
    setError('');
    try {
      const data = await loginCustomer(String(identifier || '').trim(), password);
      const profile = toUserProfile(data.customer);
      setUser(profile);
      return profile;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearCustomerToken();
    setUser(null);
    setError('');
  }, []);

  // Real registration against POST /api/customers/register. Resolves to
  // the new customer's profile — including its real id (the first
  // account ever registered is customer 1). Throws on failure, e.g. a
  // duplicate email (409) or an unreachable API.
  const signup = useCallback(async (name, email, password) => {
    setLoading(true);
    setError('');
    try {
      const data = await registerCustomer(name, email, password);
      const profile = toUserProfile(data.customer);
      setUser(profile);
      return profile;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Validate a restored session once on load: if a customer token is
  // stored, ask the API who it belongs to and refresh the profile. A
  // 401 means the token is dead — drop the session. A network failure
  // means the API can't be reached right now; keep the local profile
  // rather than signing the shopper out over a hiccup.
  useEffect(() => {
    if (!getCustomerToken()) return;
    let cancelled = false;
    fetchCustomerMe()
      .then((data) => {
        if (!cancelled && data && data.customer) setUser(toUserProfile(data.customer));
      })
      .catch((err) => {
        if (!cancelled && err && err.status === 401) {
          clearCustomerToken();
          setUser(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = {
    user,
    ageVerified,
    zip,
    loading,
    error,
    verifyAge,
    login,
    logout,
    signup,
    isAuthenticated: !!user,
    isFullyVerified: ageVerified && !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
