import type { SimPoint, SimTroughData } from '@/lib/sim-data';
import { troughPlantCode } from '@/lib/format';
import type { Batch } from '@/types';

const STORAGE_KEY = 'twcs.sim-run-history.v4';

export interface SimRunSnapshot {
  id: string;
  data: SimTroughData;
  idx: number;
  running: boolean;
}

export interface SimRunRecord {
  id: string;
  simId: string;
  troughNumber: number;
  status: 'COMPLETED' | 'ABORTED';
  startedAt: string;
  endedAt: string;
  leafIntakeKg: number;
  initialMoisture: number;
  targetMoisture: number;
  finalMoisture: number | null;
  currentMoisture: number | null;
  progressPct: number;
  elapsedMinutes: number;
  notes: string;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function loadSimRunHistory(): SimRunRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SimRunRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSimRunHistory(records: SimRunRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 200)));
}

export function clearSimRunHistory() {
  if (typeof window === 'undefined') return;
  for (const key of [
    STORAGE_KEY,
    'twcs.sim-run-history.v1',
    'twcs.sim-run-history.v2',
    'twcs.sim-run-history.v3',
  ]) {
    localStorage.removeItem(key);
  }
}

export function buildSimRunRecord(
  sim: SimRunSnapshot,
  status: 'COMPLETED' | 'ABORTED',
  wallStartedAt: number,
): SimRunRecord {
  const session = sim.data.session;
  const point: SimPoint | undefined = sim.data.timeSeries[sim.idx] ?? sim.data.timeSeries[0];
  const first = sim.data.timeSeries[0];
  const startMs = Date.parse(session.session_start);
  const atMs = point ? Date.parse(point.timestamp) : startMs;
  const elapsedMinutes = Math.max(0, Math.round((atMs - startMs) / 60_000));
  const initialMoisture = first?.current_ws_pct ?? 100;
  const currentMoisture = point?.current_ws_pct ?? null;
  const targetMoisture = session.target_ws_pct;
  const span = initialMoisture - targetMoisture;
  const progressPct =
    status === 'COMPLETED'
      ? 100
      : currentMoisture != null && span > 0
        ? clamp(((initialMoisture - currentMoisture) / span) * 100, 0, 100)
        : sim.data.timeSeries.length > 1
          ? Math.round((sim.idx / (sim.data.timeSeries.length - 1)) * 100)
          : 0;
  const n = session.trough_number;
  const endedAt = new Date().toISOString();
  const startedAt = new Date(wallStartedAt).toISOString();

  return {
    id: `sim-hist-${sim.data.id}-${wallStartedAt}`,
    simId: sim.data.id,
    troughNumber: n,
    status,
    startedAt,
    endedAt,
    leafIntakeKg: session.starting_weight_kg,
    initialMoisture,
    targetMoisture,
    finalMoisture: status === 'COMPLETED' ? currentMoisture : null,
    currentMoisture,
    progressPct,
    elapsedMinutes,
    notes: `${session.airflow_mode} · ${status === 'COMPLETED' ? 'session finished' : 'session cleared'}`,
  };
}

export function simRunToBatch(record: SimRunRecord, troughId?: string): Batch {
  const code = troughPlantCode(record.troughNumber);
  return {
    id: record.id,
    code: `RUN-${code}`,
    troughId: troughId ?? `trough-${String(record.troughNumber).padStart(2, '0')}`,
    troughCode: code,
    leafIntakeKg: record.leafIntakeKg,
    initialMoisture: record.initialMoisture,
    targetMoisture: record.targetMoisture,
    finalMoisture: record.finalMoisture,
    status: record.status,
    plannedStartAt: null,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    notes: record.notes,
    createdAt: record.startedAt,
    currentMoisture: record.currentMoisture ?? record.finalMoisture,
    progressPct: record.progressPct,
    elapsedMinutes: record.elapsedMinutes,
  };
}

export function isSimSessionFinished(sim: { idx: number; running: boolean; data: { timeSeries: unknown[] } }): boolean {
  return !sim.running && sim.idx > 0 && sim.idx >= sim.data.timeSeries.length - 1;
}
