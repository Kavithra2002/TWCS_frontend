'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  logout: () => void;
}

/** Local stand-in so role-gated controls stay visible while login is disabled. */
const DEV_USER: User = {
  id: 'dev',
  email: 'admin@example.com',
  name: 'System Admin',
  role: 'ADMIN',
};

const AuthContext = createContext<AuthState>({ user: DEV_USER, logout: () => {} });

/** Login is bypassed for now so pages can be worked on without a session. */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={{ user: DEV_USER, logout: () => {} }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
