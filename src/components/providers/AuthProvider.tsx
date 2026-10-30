'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, api } from '@/lib/api';
import { clearSession, getStoredUser, getToken, replaceStoredUser } from '@/lib/auth';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  logout: () => void;
  syncUser: (user: User) => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  logout: () => {},
  syncUser: () => {},
});

/** Restores a real signed-in account. Visitors without one go back to the login page. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || token === 'dev-session') {
      clearSession();
      router.replace('/login');
      return;
    }

    let cancelled = false;
    api<User>('/auth/me', { live: true })
      .then((fresh) => {
        if (cancelled) return;
        replaceStoredUser(fresh);
        setUser(fresh);
        setReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        if (stored && !(error instanceof ApiError && error.status === 401)) {
          setUser(stored);
          setReady(true);
          return;
        }
        clearSession();
        router.replace('/login');
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setReady(false);
    router.replace('/login');
  }, [router]);

  const syncUser = useCallback((next: User) => {
    replaceStoredUser(next);
    setUser(next);
  }, []);

  if (!ready || !user) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return <AuthContext.Provider value={{ user, logout, syncUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
