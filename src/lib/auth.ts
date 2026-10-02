import type { User } from '@/types';

const TOKEN_KEY = 'twcs.token';
const USER_KEY = 'twcs.user';

const isBrowser = () => typeof window !== 'undefined';

export function getToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): User | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (!isBrowser()) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export const roleLabel = (role: string) => (role === 'super_admin' ? 'Super admin' : role);

export const canOperate = (user: User | null) => !!user && user.role !== 'VIEWER';
export const canPlan = (user: User | null) =>
  !!user && (user.role === 'super_admin' || user.role === 'ADMIN' || user.role === 'SUPERVISOR');
