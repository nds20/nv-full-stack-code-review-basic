import { createContext, useState } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isVerified, setIsVerified] = useState(false);

  return (
    <AuthContext.Provider value={{ user, setUser, isVerified, setIsVerified }}>
      {children}
    </AuthContext.Provider>
  );
}
