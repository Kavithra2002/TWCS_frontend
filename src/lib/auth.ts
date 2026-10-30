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

/** Keep the signed-in profile in sync after that account is edited. */
export function replaceStoredUser(user: User) {
  if (!isBrowser()) return;
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

export const overviewTitleForRole = (role: string) =>
  isAssignableRole(role) ? ROLE_OVERVIEW_TITLE[role] : 'Overview';

export const canManageUsers = (user: User | null | undefined) => isSuperAdmin(user);

/**
 * Pages each role may open. Super admin is unrestricted.
 * Executive designations share the same pages; trough scope is separate.
 */
const ROLE_PATHS: Record<string, readonly string[]> = {
  executive: ['/', '/dashboard-2'],
  operation: [
    '/dashboard-2',
    '/simulator',
    '/test-version',
    '/test-version-2',
    '/troughs',
    '/batches',
    '/schedules',
    '/reports',
    '/settings',
  ],
  engineering: ['/troughs', '/batches', '/reports', '/settings'],
};

const pathAllowed = (pathname: string, allowed: string) =>
  allowed === '/' ? pathname === '/' : pathname === allowed || pathname.startsWith(`${allowed}/`);

/** First page this account should land on after sign-in. */
export function homePathFor(user: User | null | undefined): string {
  if (!user) return '/login';
  if (isSuperAdmin(user)) return '/';
  return ROLE_PATHS[user.role]?.[0] ?? '/login';
}

/** Paths a signed-in user may open. Unknown roles are denied. */
export function canAccessPath(user: User | null | undefined, pathname: string): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const paths = ROLE_PATHS[user.role];
  if (!paths) return false;
  return paths.some((allowed) => pathAllowed(pathname, allowed));
}

/** General managers keep the Executive role but only see assigned troughs. */
export function isGeneralManager(user: User | null | undefined): boolean {
  return user?.role === 'executive' && user.executiveConfig?.designation === 'general_manager';
}

export const canOperate = (user: User | null) => !!user && user.role !== 'VIEWER';
export const canPlan = (user: User | null) =>
  !!user &&
  (user.role === 'super_admin' ||
    user.role === 'ADMIN' ||
    user.role === 'SUPERVISOR' ||
    user.role === 'executive' ||
    user.role === 'engineering');
