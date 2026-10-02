import type { User } from '@/types';
import { clearSession, getStoredUser, setSession } from './auth';

export type DevViewId = 'executive' | 'operational' | 'engineering';

export interface DevPersona {
  id: DevViewId;
  index: string;
  title: string;
  tagline: string;
  audience: string;
  /** Permission label shown while real authentication is still in development. */
  access: string;
  color: string;
  user: User;
}

/** Stand-in accounts for the three console views until login is implemented. */
export const DEV_PERSONAS: DevPersona[] = [
  {
    id: 'executive',
    index: '1',
    title: 'Executive view',
    tagline: 'The big picture. Simple. Actionable.',
    audience: 'For executives and senior management',
    access: 'Viewer',
    color: '#1c7c43',
    user: {
      id: 'dev-executive',
      email: 'executive@twcs.local',
      name: 'Senior Management',
      role: 'VIEWER',
    },
  },
  {
    id: 'operational',
    index: '2',
    title: 'Operational view',
    tagline: 'Real-time control at your fingertips.',
    audience: 'For factory managers, tea masters and supervisors',
    access: 'Supervisor',
    color: '#2f6eae',
    user: {
      id: 'dev-operational',
      email: 'operations@twcs.local',
      name: 'Factory Supervisor',
      role: 'SUPERVISOR',
    },
  },
  {
    id: 'engineering',
    index: '3',
    title: 'Engineering view',
    tagline: 'Detailed data. Deeper insight.',
    audience: 'For engineers, analysts and technical support',
    access: 'Admin',
    color: '#d4721a',
    user: {
      id: 'dev-engineering',
      email: 'engineering@twcs.local',
      name: 'Technical Support',
      role: 'ADMIN',
    },
  },
];

const VIEW_KEY = 'twcs.view';
const DEV_TOKEN = 'dev-session';

export function signInAsPersona(id: DevViewId) {
  const persona = DEV_PERSONAS.find((item) => item.id === id);
  if (!persona) return;
  setSession(DEV_TOKEN, persona.user);
  localStorage.setItem(VIEW_KEY, id);
}

export function getActivePersona(): DevPersona | null {
  if (typeof window === 'undefined') return null;
  try {
    const storedId = localStorage.getItem(VIEW_KEY);
    const byId = DEV_PERSONAS.find((item) => item.id === storedId);
    if (byId) return byId;
    const user = getStoredUser();
    return DEV_PERSONAS.find((item) => item.user.id === user?.id) ?? null;
  } catch {
    return null;
  }
}

export function endDevSession() {
  clearSession();
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(VIEW_KEY);
  } catch {
    /* storage unavailable */
  }
}
