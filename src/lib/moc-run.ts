import { readFileSync } from 'node:fs';
import path from 'node:path';

/** One plotted sample from the probe time series. */
export interface WitherSnapshotPoint {
  file: string;
  hour: number;
  weightKg: number;
  wsPct: number;
  fanHz: number | null;
  hotLouverPct: number | null;
  ambLouverPct: number | null;
}

export interface WitherRun {
  points: WitherSnapshotPoint[];
  /** Hours from session start to SMR done / IMR1 start. */
  surfaceEndHour: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Elapsed hours from the session start, rounded to 0.01 h. */
function hoursSince(startIso: string, atIso: string): number {
  const ms = Date.parse(atIso) - Date.parse(startIso);
  if (!Number.isFinite(ms)) return 0;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

function readJson(dir: string, name: string): unknown {
  return JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
}

/**
 * Waltrim trough session from backend/moc_json.
 * Weight is starting_weight_kg × current_ws_pct / 100.
 * Fan speed, hot louver, and ambient louver come from the probe samples.
 * The surface/internal split is the SMRDone/IMR1Start event.
 */
export function loadWitherRun(): WitherRun {
  const dir = path.resolve(process.cwd(), '..', 'backend', 'moc_json');
  const session = asRecord(readJson(dir, 'sessio.json'));
  const series = readJson(dir, 'time_series.json');
  const events = readJson(dir, 'event.json');

  const startIso = text(session?.session_start);
  const startKg = num(session?.starting_weight_kg) ?? 0;
  const points: WitherSnapshotPoint[] = [];

  if (Array.isArray(series) && startIso) {
    for (const item of series) {
      const row = asRecord(item);
      if (!row) continue;
      const ws = num(row.current_ws_pct);
      const stamp = text(row.timestamp);
      if (ws == null || !stamp) continue;
      points.push({
        file: stamp,
        hour: hoursSince(startIso, stamp),
        weightKg: Math.round(startKg * (ws / 100) * 10) / 10,
        wsPct: ws,
        fanHz: num(row.fan_speed_hz),
        hotLouverPct: num(row.hot_louver_position_pct),
        ambLouverPct: num(row.amb_louver_position_pct),
      });
    }
  }

  let surfaceEndHour = points.length > 0 ? points[points.length - 1].hour : 0;
  if (Array.isArray(events) && startIso) {
    for (const item of events) {
      const row = asRecord(item);
      if (!row || row.event_type !== 'SMRDone/IMR1Start') continue;
      const stamp = text(row.timestamp);
      if (stamp) surfaceEndHour = hoursSince(startIso, stamp);
      break;
    }
  }

  return { points, surfaceEndHour };
}
