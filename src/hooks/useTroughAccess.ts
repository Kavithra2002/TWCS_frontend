'use client';

import useSWR from 'swr';
import { useAuth } from '@/components/providers/AuthProvider';
import { useSimulator, type SimTroughState } from '@/contexts/SimulatorContext';
import { api } from '@/lib/api';
import { isGeneralManager } from '@/lib/auth';
import type { Trough } from '@/types';

export function troughNumberFromCode(code: string | null | undefined): number | null {
  if (!code) return null;
  const digits = code.match(/(\d+)\s*$/)?.[1];
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

/** Plant numbers a general manager may see. Null means the full trough list. */
export function assignedTroughNumbers(troughs: Trough[], troughIds: string[]): Set<number> {
  const allowedIds = new Set(troughIds);
  const numbers = new Set<number>();
  for (const trough of troughs) {
    if (!allowedIds.has(trough.id)) continue;
    const number = troughNumberFromCode(trough.code);
    if (number != null) numbers.add(number);
  }
  return numbers;
}

/** Simulator troughs visible to the signed-in account. */
export function useVisibleSimTroughs() {
  const { user } = useAuth();
  const { state } = useSimulator();
  const restricted = isGeneralManager(user);
  const { data, error } = useSWR<Trough[]>(
    restricted ? 'assigned-troughs' : null,
    () => api<Trough[]>('/troughs', { live: true }),
  );

  const allowed = restricted
    ? data
      ? assignedTroughNumbers(data, user?.executiveConfig?.troughIds ?? [])
      : new Set<number>()
    : null;

  const troughs: SimTroughState[] = Object.values(state.troughs)
    .filter((trough) => allowed == null || allowed.has(trough.data.session.trough_number))
    .sort((a, b) => a.data.session.trough_number - b.data.session.trough_number);

  return {
    troughs,
    allowed,
    restricted,
    ready: state.loaded && (!restricted || data !== undefined || error !== undefined),
    error: restricted ? error : undefined,
  };
}
