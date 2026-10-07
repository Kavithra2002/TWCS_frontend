import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export interface SimSession {
  withering_id: string;
  trough_number: number;
  session_start: string;
  imr1_start: string;
  lto_start: string;
  lto_done: string;
  session_end: string;
  starting_weight_kg: number;
  target_ws_pct: number;
  airflow_mode: string;
  factory_name: string;
}

export interface SimEvent {
  event_id: string;
  withering_id: string;
  event_type: string;
  timestamp: string;
  user_id: string | null;
  notes: string;
}

export interface SimPoint {
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

export interface SimTroughData {
  id: string;
  session: SimSession;
  events: SimEvent[];
  timeSeries: SimPoint[];
}

function readJson(filePath: string): unknown {
  if (!existsSync(filePath)) return null;
  // Strip UTF-8 BOM (﻿) that PowerShell 5.1 adds when writing files
  const raw = readFileSync(filePath, 'utf8').replace(/^﻿/, '');
  return JSON.parse(raw);
}

function loadTrough(id: string, dir: string, sessionFile: string, eventFile: string, tsFile: string): SimTroughData | null {
  const session = readJson(path.join(dir, sessionFile));
  const events = readJson(path.join(dir, eventFile));
  const ts = readJson(path.join(dir, tsFile));
  if (!session || !events || !ts) return null;
  return {
    id,
    session: session as SimSession,
    events: events as SimEvent[],
    timeSeries: ts as SimPoint[],
  };
}

export function loadAllSimData(): SimTroughData[] {
  const base = path.resolve(process.cwd(), '..', 'backend', 'moc_json');
  const results: SimTroughData[] = [];

  // t01–t06: all trough sessions
  for (let i = 1; i <= 6; i++) {
    const id = `t0${i}`;
    const dir = path.join(base, id);
    const t = loadTrough(id, dir, 'session.json', 'event.json', 'time_series.json');
    if (t) results.push(t);
  }

  return results;
}
