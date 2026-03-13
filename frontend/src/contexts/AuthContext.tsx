import { createContext, useContext, useState } from 'react';

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

  const login = (email: string, _password: string) => {
    if (!email) return false;
    const u = { email, name: email.split('@')[0] };
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
