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

export const ASSIGNABLE_ROLES = [
  { value: 'executive', label: 'Executive' },
  { value: 'operation', label: 'Operation' },
  { value: 'engineering', label: 'Engineering' },
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]['value'];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  executive: 'Executive',
  operation: 'Operation',
  engineering: 'Engineering',
};

const EXECUTIVE_DESIGNATION_LABELS: Record<string, string> = {
  standard: 'Normal executive',
  general_manager: 'General manager',
};

export const executiveDesignationLabel = (designation: string) =>
  EXECUTIVE_DESIGNATION_LABELS[designation] ?? designation;

/** Overview headings for the three factory roles (placeholders until each view is built out). */
const ROLE_OVERVIEW_TITLE: Record<AssignableRole, string> = {
  executive: 'Executive View',
  operation: 'Operation View',
  engineering: 'Engineering View',
};

export const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;

export const isSuperAdmin = (user: User | null | undefined) => user?.role === 'super_admin';

export const isAssignableRole = (role: string): role is AssignableRole =>
  ASSIGNABLE_ROLES.some((item) => item.value === role);

/** Factory roles that currently only see Overview. */
export const isOverviewOnlyRole = (user: User | null | undefined) =>
  !!user && isAssignableRole(user.role);

export const overviewTitleForRole = (role: string) =>
  isAssignableRole(role) ? ROLE_OVERVIEW_TITLE[role] : 'Overview';

export const canManageUsers = (user: User | null | undefined) => isSuperAdmin(user);

/** Paths a signed-in user may open. Overview-only roles are locked to `/`. */
export function canAccessPath(user: User | null | undefined, pathname: string): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (isOverviewOnlyRole(user)) return pathname === '/';
  return true;
}

export const canOperate = (user: User | null) => !!user && user.role !== 'VIEWER';
export const canPlan = (user: User | null) =>
  !!user &&
  (user.role === 'super_admin' ||
    user.role === 'ADMIN' ||
    user.role === 'SUPERVISOR' ||
    user.role === 'executive' ||
    user.role === 'engineering');
