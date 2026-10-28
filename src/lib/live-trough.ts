import type { SimPoint } from '@/lib/sim-data';
import type { RawVboxRow } from '@/types';

/** Simulator trough whose Run button opens the droplet SSH tunnel. */
export const LIVE_TROUGH_ID = 't06';

export function isLiveTroughId(id: string) {
  return id === LIVE_TROUGH_ID;
}

export interface LivePlayback {
  data: { id: string; timeSeries: SimPoint[] };
  idx: number;
  running: boolean;
  livePoints: SimPoint[];
}

export function playback(t: LivePlayback) {
  const live = isLiveTroughId(t.data.id);
  const series = live ? t.livePoints : t.data.timeSeries;
  const idx = live ? Math.max(0, series.length - 1) : t.idx;
  const point = series.length ? series[Math.min(idx, series.length - 1)] : undefined;
  return { live, series, idx, point };
}

/** True once a trough has something to draw. Trough 6 stays false until a real sample arrives. */
export function hasSimProgress(t: LivePlayback) {
  if (isLiveTroughId(t.data.id)) return t.livePoints.length > 0;
  return t.idx > 0;
}

export function isSimActive(t: LivePlayback) {
  return t.running || hasSimProgress(t);
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Zeros and blanks are not a withering run yet — keep the trough empty. */
export function isBlankReading(point: SimPoint) {
  const values = [
    point.current_ws_pct,
    point.weight_kg,
    point.ambient_temp_c,
    point.ambient_rh_pct,
    point.inlet_temp_c,
    point.inlet_rh_pct,
    point.upper_temp_c,
    point.upper_rh_pct,
    point.fan_speed_hz,
    point.cumulative_energy_kwh,
  ];
  return values.every((value) => value == null || Math.abs(value) < 1e-6);
}

export function vboxRowsToPoints(rows: RawVboxRow[]): SimPoint[] {
  const points: SimPoint[] = [];
  for (const row of [...rows].reverse()) {
    const payload = row.payload ?? {};
    const point: SimPoint = {
      timestamp: String(payload.timestamp || row.receivedAt),
      ambient_rh_pct: num(payload.ambient_rh_pct),
      ambient_temp_c: num(payload.ambient_temp_c),
      inlet_rh_pct: num(payload.inlet_rh_pct),
      inlet_temp_c: num(payload.inlet_temp_c),
      upper_rh_pct: num(payload.upper_rh_pct),
      upper_temp_c: num(payload.upper_temp_c),
      lower_rh_pct: num(payload.lower_rh_pct),
      lower_temp_c: num(payload.lower_temp_c),
      chamber_pressure_pa: num(payload.chamber_pressure_pa),
      pressure_demand_pa: num(payload.pressure_demand_pa),
      fan_speed_hz: num(payload.fan_speed_hz),
      hot_louver_position_pct: num(payload.hot_louver_position_pct),
      hot_louver_demand_pct: num(payload.hot_louver_demand_pct),
      amb_louver_position_pct: num(payload.amb_louver_position_pct),
      amb_louver_demand_pct: num(payload.amb_louver_demand_pct),
      cumulative_energy_kwh: num(payload.cumulative_energy_kwh),
      current_ws_pct: num(payload.current_ws_pct),
      weight_kg: num(payload.weight_kg),
    };
    if (isBlankReading(point)) continue;
    points.push(point);
  }
  return points;
}
