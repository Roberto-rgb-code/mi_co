import { createContext, useContext, useState } from 'react';
import {
  HARDCODED_LOGIN_EMAIL,
  HARDCODED_LOGIN_PASSWORD,
} from '../config/authCredentials';

interface User {
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('isuzu_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (email: string, password: string) => {
    const e = email.trim().toLowerCase();
    const expected = HARDCODED_LOGIN_EMAIL.trim().toLowerCase();
    if (!e || !password) return false;
    if (e !== expected || password !== HARDCODED_LOGIN_PASSWORD) {
      return false;
    }
    const u = { email: email.trim(), name: email.trim().split('@')[0] || 'Usuario' };
    setUser(u);
    sessionStorage.setItem('isuzu_user', JSON.stringify(u));
    return true;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('isuzu_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
