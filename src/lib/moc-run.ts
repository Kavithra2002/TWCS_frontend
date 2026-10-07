import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Full raw time-series snapshot as stored in the JSON file. */
export interface TimeSeriesPoint {
  timestamp: string;
  ambient_rh_pct: number | null;
  ambient_temp_c: number | null;
  inlet_rh_pct: number | null;
  inlet_temp_c: number | null;
  upper_rh_pct: number | null;
  upper_temp_c: number | null;
  lower_rh_pct: number | null;
  lower_temp_c: number | null;
  chamber_pressure_pa: number | null;
  pressure_demand_pa: number | null;
  fan_speed_hz: number | null;
  hot_louver_position_pct: number | null;
  hot_louver_demand_pct: number | null;
  amb_louver_position_pct: number | null;
  amb_louver_demand_pct: number | null;
  cumulative_energy_kwh: number | null;
  current_ws_pct: number | null;
  weight_kg: number | null;
}

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

/** Load every raw time-series record from time_series.json. */
export function loadTimeSeriesPoints(): TimeSeriesPoint[] {
  const dir = path.resolve(process.cwd(), '..', 'backend', 'moc_json');
  const series = readJson(dir, 'time_series.json');
  if (!Array.isArray(series)) return [];
  return series.map((item) => {
    const row = asRecord(item) ?? {};
    return {
      timestamp: (text(row.timestamp) ?? ''),
      ambient_rh_pct: num(row.ambient_rh_pct),
      ambient_temp_c: num(row.ambient_temp_c),
      inlet_rh_pct: num(row.inlet_rh_pct),
      inlet_temp_c: num(row.inlet_temp_c),
      upper_rh_pct: num(row.upper_rh_pct),
      upper_temp_c: num(row.upper_temp_c),
      lower_rh_pct: num(row.lower_rh_pct),
      lower_temp_c: num(row.lower_temp_c),
      chamber_pressure_pa: num(row.chamber_pressure_pa),
      pressure_demand_pa: num(row.pressure_demand_pa),
      fan_speed_hz: num(row.fan_speed_hz),
      hot_louver_position_pct: num(row.hot_louver_position_pct),
      hot_louver_demand_pct: num(row.hot_louver_demand_pct),
      amb_louver_position_pct: num(row.amb_louver_position_pct),
      amb_louver_demand_pct: num(row.amb_louver_demand_pct),
      cumulative_energy_kwh: num(row.cumulative_energy_kwh),
      current_ws_pct: num(row.current_ws_pct),
      weight_kg: num(row.weight_kg),
    };
  });
}
