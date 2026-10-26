import React, { createContext, useState, useCallback, useEffect } from 'react';

export const AuthContext = createContext();

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

  const login = useCallback(async (identifier, password) => {
    setLoading(true);
    setError('');
    try {
      // TODO: Call backend API to authenticate user
      // const response = await fetch('/api/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ identifier, password })
      // });
      // if (!response.ok) throw new Error('Invalid credentials');
      // const data = await response.json();
      
      const userData = {
        id: Date.now(),
        identifier,
        email: identifier.includes('@') ? identifier : `${identifier}@smoke.shop`,
        subscription: { plan: 'free', active: true },
        createdAt: new Date().toISOString()
      };
      setUser(userData);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setError('');
  }, []);

  const signup = useCallback(async (email, password) => {
    setLoading(true);
    setError('');
    try {
      // TODO: Call backend API to create account
      // const response = await fetch('/api/auth/signup', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, password })
      // });
      // if (!response.ok) throw new Error('Signup failed');
      // const data = await response.json();
      
      const userData = {
        id: Date.now(),
        email,
        identifier: email,
        subscription: { plan: 'free', active: true },
        createdAt: new Date().toISOString()
      };
      setUser(userData);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
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
