import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** One plotted sample taken from a mock withering packet. */
export interface WitherSnapshotPoint {
  file: string;
  hour: number;
  weightKg: number;
  vfdHz: number | null;
  hotLouverPct: number | null;
  coldLouverPct: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** Time-series packet, tolerant of a future shape as long as packet type 3 is present. */
function timeSeries(doc: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(doc.packets)) return null;
  for (const packet of doc.packets) {
    const row = asRecord(packet);
    if (!row) continue;
    if (row.packet_type_name === 'TimeSeries' || row.packet_type === 3) return row;
  }
  return null;
}

/** Reads backend/moc_json/mocNN.json in numeric order. */
export function loadWitherRun(): WitherSnapshotPoint[] {
  const dir = path.resolve(process.cwd(), '..', 'backend', 'moc_json');
  const files = readdirSync(dir)
    .filter((name) => /^moc\d+\.json$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const points: WitherSnapshotPoint[] = [];
  files.forEach((file, index) => {
    const doc = asRecord(JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
    if (!doc) return;
    const series = timeSeries(doc);
    if (!series) return;
    const weight = num(series.current_weight_kg);
    if (weight == null) return;
    const elapsedMin = num(series.elapsed_wither_min);
    points.push({
      file,
      hour: elapsedMin == null ? index : Math.round((elapsedMin / 60) * 100) / 100,
      weightKg: weight,
      vfdHz: num(series.vfd_frequency_hz),
      hotLouverPct: num(series.hot_louver_position_pct),
      coldLouverPct: num(series.cold_louver_position_pct),
    });
  });

  return points;
}
