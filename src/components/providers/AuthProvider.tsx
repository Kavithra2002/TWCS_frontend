'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser } from '@/lib/auth';
import { endDevSession, getActivePersona, type DevPersona } from '@/lib/dev-personas';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  persona: DevPersona | null;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  persona: null,
  logout: () => {},
});

/** Restores the test user chosen on the login screen. Sends visitors without one back to login. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [persona, setPersona] = useState<DevPersona | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/login');
      return;
    }
    setUser(stored);
    setPersona(getActivePersona());
    setReady(true);
  }, [router]);

  const logout = useCallback(() => {
    endDevSession();
    setUser(null);
    setPersona(null);
    setReady(false);
    router.replace('/login');
  }, [router]);

  if (!ready || !user) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return <AuthContext.Provider value={{ user, persona, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
