'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, getStoredUser, getToken } from '@/lib/auth';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  logout: () => {},
});

/** Restores a real signed-in account. Visitors without one go back to the login page. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || token === 'dev-session' || !stored) {
      clearSession();
      router.replace('/login');
      return;
    }
    setUser(stored);
    setReady(true);
  }, [router]);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setReady(false);
    router.replace('/login');
  }, [router]);

  if (!ready || !user) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
