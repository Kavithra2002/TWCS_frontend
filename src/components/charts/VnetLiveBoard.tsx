'use client';

import { Droplets, Leaf, Scale, Thermometer, Wind, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Gauge } from '@/components/charts/Gauge';
import { fmtNumber, fmtTimeSec } from '@/lib/format';
import type { RawVboxRow } from '@/types';

const FIELDS = [
  'current_ws_pct',
  'weight_kg',
  'ambient_temp_c',
  'ambient_rh_pct',
  'inlet_temp_c',
  'inlet_rh_pct',
  'upper_temp_c',
  'upper_rh_pct',
  'lower_temp_c',
  'lower_rh_pct',
  'chamber_pressure_pa',
  'pressure_demand_pa',
  'fan_speed_hz',
  'hot_louver_position_pct',
  'hot_louver_demand_pct',
  'amb_louver_position_pct',
  'amb_louver_demand_pct',
  'cumulative_energy_kwh',
] as const;

type Field = (typeof FIELDS)[number];

interface Point {
  ts: number;
  values: Record<Field, number | null>;
}

const TEMP_LAYERS = [
  { key: 'ambient_temp_c' as const, name: 'Ambient', color: '#fb923c' },
  { key: 'inlet_temp_c' as const, name: 'Inlet', color: '#fdba74' },
  { key: 'upper_temp_c' as const, name: 'Upper', color: '#34d399' },
  { key: 'lower_temp_c' as const, name: 'Lower', color: '#6ee7b7' },
];

const RH_LAYERS = [
  { key: 'ambient_rh_pct' as const, name: 'Ambient', color: '#38bdf8' },
  { key: 'inlet_rh_pct' as const, name: 'Inlet', color: '#7dd3fc' },
  { key: 'upper_rh_pct' as const, name: 'Upper', color: '#34d399' },
  { key: 'lower_rh_pct' as const, name: 'Lower', color: '#10b981' },
];

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseTs(raw: unknown, fallback: string): number {
  const source = String(raw ?? '').trim();
  const parsed = Date.parse(source.includes('T') ? source : source.replace(' ', 'T'));
  if (Number.isFinite(parsed)) return parsed;
  const fb = Date.parse(fallback);
  return Number.isFinite(fb) ? fb : Date.now();
}

function toPoints(rows: RawVboxRow[]): Point[] {
  let lastTs = Number.NEGATIVE_INFINITY;
  return [...rows].reverse().map((row) => {
    const values = {} as Record<Field, number | null>;
    for (const key of FIELDS) values[key] = num(row.payload[key]);
    // Recharts uses the x value as a tick key. Rows often share a timestamp, so nudge
    // collisions by 1ms. Order stays the same and the clock label does not change.
    let ts = parseTs(row.payload.timestamp, row.receivedAt);
    if (ts <= lastTs) ts = lastTs + 1;
    lastTs = ts;
    return { ts, values };
  });
}

function isBlankPoint(point: Point) {
  const keys: Field[] = ['current_ws_pct', 'weight_kg', 'ambient_temp_c', 'ambient_rh_pct'];
  return keys.every((key) => {
    const value = point.values[key];
    return value == null || Math.abs(value) < 1e-6;
  });
}

function latest(points: Point[], key: Field): number | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (isBlankPoint(points[i])) continue;
    const value = points[i].values[key];
    if (value != null) return value;
  }
  return null;
}

function previous(points: Point[], key: Field): number | null {
  let seen = 0;
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (isBlankPoint(points[i])) continue;
    const value = points[i].values[key];
    if (value == null) continue;
    seen += 1;
    if (seen === 2) return value;
  }
  return null;
}

function history(points: Point[], key: Field): number[] {
  return points.map((point) => point.values[key]).filter((value): value is number => value != null);
}

function deltaHint(curr: number | null, prev: number | null, decimals: number, unit: string): string | undefined {
  if (curr == null || prev == null) return undefined;
  const delta = curr - prev;
  if (Math.abs(delta) < 10 ** -(decimals + 1)) return 'Steady since last sample';
  const arrow = delta > 0 ? '▲' : '▼';
  return `${arrow} ${Math.abs(delta).toFixed(decimals)} ${unit} since last sample`;
}

function niceStep(span: number) {
  const rough = span / 4 || 1;
  const exp = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / exp;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return step * exp;
}

/** Keep a flat series off the axis edge so a steady reading still has a readable scale. */
function paddedDomain(values: Array<number | null>): [number, number] {
  const nums = values.filter((value): value is number => value != null);
  if (!nums.length) return [0, 1];
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const pad = hi === lo ? Math.max(Math.abs(hi) * 0.04, 0.05) : (hi - lo) * 0.2;
  const step = niceStep((hi + pad) - (lo - pad));
  const min = Math.floor((lo - pad) / step) * step;
  const max = Math.ceil((hi + pad) / step) * step;
  return [Number(min.toPrecision(6)), Number(max.toPrecision(6))];
}

function activeLayers<T extends { key: Field }>(layers: T[], points: Point[]): T[] {
  const moving = layers.filter((layer) => history(points, layer.key).some((value) => value !== 0));
  return moving.length ? moving : layers;
}

/** Scale a gauge to the live value when the reading sits in a narrow band. */
function niceMax(value: number | null, fallback: number): number {
  if (value == null || value <= 0) return fallback;
  const padded = value * 1.35;
  const exp = 10 ** Math.floor(Math.log10(padded));
  const scaled = padded / exp;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * exp;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const width = 120;
  const height = 28;
  if (data.length < 2) return <div style={{ height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const coords = data.map((value, index) => ({
    x: (index / (data.length - 1)) * width,
    y: height - 3 - ((value - min) / span) * (height - 6),
  }));
  const line = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const fill = [...coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`), `${width},${height}`, `0,${height}`].join(' ');
  const id = `vnet-spark-${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={fill} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Kpi({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  color,
  spark,
}: {
  label: string;
  value: string;
  unit: string;
  hint?: string;
  icon: LucideIcon;
  color: string;
  spark: number[];
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}22` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-50">
        {value}
        <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>
      </p>
      <div className="mt-2">
        <Sparkline data={spark} color={color} />
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70">
      <header className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

const tooltipStyle = {
  background: 'var(--chart-tooltip-bg)',
  color: 'var(--chart-tooltip-fg)',
  border: '1px solid var(--chart-tooltip-border)',
  borderRadius: 8,
  fontSize: 12,
};

function timeLabel(rows: { ts: number }[], index: unknown) {
  const row = rows[Number(index)];
  return row ? fmtTimeSec(row.ts) : '';
}

/** Index axis. A time scale repeats tick keys when two samples share a timestamp. */
function TimeXAxis({ rows, minTickGap = 28 }: { rows: { ts: number }[]; minTickGap?: number }) {
  return (
    <XAxis
      dataKey="i"
      type="category"
      allowDuplicatedCategory={false}
      tickFormatter={(value) => timeLabel(rows, value)}
      tickLine={false}
      axisLine={false}
      minTickGap={minTickGap}
      interval="preserveStartEnd"
    />
  );
}

function LayerBars({
  title,
  unit,
  decimals,
  layers,
  points,
}: {
  title: string;
  unit: string;
  decimals: number;
  layers: { key: Field; name: string; color: string }[];
  points: Point[];
}) {
  const rows = layers.map((layer) => ({ ...layer, value: latest(points, layer.key) }));
  const peak = Math.max(1, ...rows.map((row) => Math.abs(row.value ?? 0)));
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <div className="space-y-2.5">
        {rows.map((row) => {
          const width = row.value == null || row.value === 0 ? 0 : Math.max(2, (Math.abs(row.value) / peak) * 100);
          return (
            <div key={row.key}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-slate-400">{row.name}</span>
                <span className="font-semibold tabular-nums text-slate-100">
                  {fmtNumber(row.value, decimals)}
                  <span className="ml-1 font-normal text-slate-500">{unit}</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${width}%`, backgroundColor: row.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PairBar({
  label,
  actual,
  demand,
  unit,
  color,
  decimals,
}: {
  label: string;
  actual: number | null;
  demand: number | null;
  unit: string;
  color: string;
  decimals: number;
}) {
  const peak = Math.max(1, Math.abs(actual ?? 0), Math.abs(demand ?? 0));
  const actualWidth = actual == null ? 0 : Math.max(actual === 0 ? 0 : 2, (Math.abs(actual) / peak) * 100);
  const demandWidth = demand == null ? 0 : Math.max(demand === 0 ? 0 : 2, (Math.abs(demand) / peak) * 100);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-[11px] tabular-nums text-slate-500">{unit}</span>
      </div>
      <Meter label="Position" width={actualWidth} color={color} text={fmtNumber(actual, decimals)} />
      <div className="mt-1.5">
        <Meter label="Demand" width={demandWidth} color="#94a3b8" text={fmtNumber(demand, decimals)} />
      </div>
    </div>
  );
}

function Meter({ label, width, color, text }: { label: string; width: number; color: string; text: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-2 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
      <span className="text-right font-medium tabular-nums text-slate-200">{text}</span>
    </div>
  );
}

export function VnetLiveBoard({ rows }: { rows: RawVboxRow[] }) {
  const points = useMemo(() => toPoints(rows), [rows]);
  const chartRows = useMemo(
    () =>
      points.map((point, index) => ({
        i: index,
        ts: point.ts,
        ...point.values,
      })),
    [points],
  );

  if (!points.length) {
    return (
      <section className="mb-4 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-10 text-center">
        <p className="text-sm font-medium text-slate-300">Live charts appear with the first table row</p>
        <p className="mt-1 text-xs text-slate-500">Weight, wither standard, temperature, humidity, and actuators plot from raw_vbox_data.</p>
      </section>
    );
  }

  const ws = latest(points, 'current_ws_pct');
  const weight = latest(points, 'weight_kg');
  const ambTemp = latest(points, 'ambient_temp_c');
  const ambRh = latest(points, 'ambient_rh_pct');
  const fan = latest(points, 'fan_speed_hz');
  const energy = latest(points, 'cumulative_energy_kwh');
  const tempLayers = activeLayers(TEMP_LAYERS, points);
  const rhLayers = activeLayers(RH_LAYERS, points);
  const quietTemp = TEMP_LAYERS.filter((layer) => !tempLayers.includes(layer)).map((layer) => layer.name);
  const quietRh = RH_LAYERS.filter((layer) => !rhLayers.includes(layer)).map((layer) => layer.name);
  const from = fmtTimeSec(points[0].ts);
  const to = fmtTimeSec(points[points.length - 1].ts);
  const span = `${points.length} samples · ${from} – ${to}`;

  return (
    <div className="mb-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Wither std"
          value={fmtNumber(ws, 2)}
          unit="%"
          icon={Leaf}
          color="#2e9862"
          spark={history(points, 'current_ws_pct')}
          hint={deltaHint(ws, previous(points, 'current_ws_pct'), 2, '%')}
        />
        <Kpi
          label="Weight"
          value={fmtNumber(weight, 1)}
          unit="kg"
          icon={Scale}
          color="#4ade80"
          spark={history(points, 'weight_kg')}
          hint={deltaHint(weight, previous(points, 'weight_kg'), 1, 'kg')}
        />
        <Kpi
          label="Ambient temp"
          value={fmtNumber(ambTemp, 1)}
          unit="°C"
          icon={Thermometer}
          color="#fb923c"
          spark={history(points, 'ambient_temp_c')}
          hint={deltaHint(ambTemp, previous(points, 'ambient_temp_c'), 1, '°C')}
        />
        <Kpi
          label="Ambient RH"
          value={fmtNumber(ambRh, 1)}
          unit="%"
          icon={Droplets}
          color="#38bdf8"
          spark={history(points, 'ambient_rh_pct')}
          hint={deltaHint(ambRh, previous(points, 'ambient_rh_pct'), 1, '%')}
        />
        <Kpi
          label="Fan speed"
          value={fmtNumber(fan, 1)}
          unit="Hz"
          icon={Wind}
          color="#4ade80"
          spark={history(points, 'fan_speed_hz')}
          hint={deltaHint(fan, previous(points, 'fan_speed_hz'), 1, 'Hz')}
        />
        <Kpi
          label="Cumul. energy"
          value={fmtNumber(energy, 3)}
          unit="kWh"
          icon={Zap}
          color="#facc15"
          spark={history(points, 'cumulative_energy_kwh')}
          hint={deltaHint(energy, previous(points, 'cumulative_energy_kwh'), 3, 'kWh')}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <Panel title="Leaf weight and wither standard" subtitle={span}>
          <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Weight · kg</p>
          <ResponsiveContainer width="100%" height={168}>
            <ComposedChart data={chartRows} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="vnet-weight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2e9862" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2e9862" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <TimeXAxis rows={chartRows} minTickGap={36} />
              <YAxis tickLine={false} axisLine={false} width={52} domain={paddedDomain(points.map((point) => point.values.weight_kg))} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => timeLabel(chartRows, value)} formatter={(value: number) => [`${fmtNumber(value, 1)} kg`, 'Weight']} />
              <Area dataKey="weight_kg" name="Weight" stroke="#2e9862" fill="url(#vnet-weight)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mb-1 mt-3 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Wither standard · %</p>
          <ResponsiveContainer width="100%" height={140}>
            <ComposedChart data={chartRows} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <TimeXAxis rows={chartRows} minTickGap={36} />
              <YAxis tickLine={false} axisLine={false} width={52} domain={paddedDomain(points.map((point) => point.values.current_ws_pct))} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => timeLabel(chartRows, value)} formatter={(value: number) => [`${fmtNumber(value, 2)} %`, 'Wither std']} />
              <Line dataKey="current_ws_pct" name="Wither std" stroke="#eab308" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Live gauges" subtitle="Latest row, scaled to the reading">
          <div className="grid grid-cols-2 gap-2">
            <Gauge value={ws} min={0} max={niceMax(ws, 100)} label="Wither std" unit="%" color="#2e9862" decimals={2} />
            <Gauge value={weight} min={0} max={niceMax(weight, 500)} label="Weight" unit="kg" color="#4ade80" decimals={1} />
            <Gauge value={ambRh} min={0} max={100} label="Ambient RH" unit="%" color="#38bdf8" decimals={1} />
            <Gauge value={ambTemp} min={0} max={45} label="Ambient temp" unit="°C" color="#fb923c" decimals={1} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Temperature"
          subtitle={quietTemp.length ? `Ambient movement · ${quietTemp.join(', ')} stayed at 0 °C` : 'Ambient, inlet, upper, and lower · °C'}
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartRows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <TimeXAxis rows={chartRows} />
              <YAxis tickLine={false} axisLine={false} width={44} domain={paddedDomain(tempLayers.flatMap((layer) => points.map((point) => point.values[layer.key])))} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => timeLabel(chartRows, value)} formatter={(value: number, name) => [`${fmtNumber(value, 1)} °C`, name]} />
              <Legend verticalAlign="top" height={22} wrapperStyle={{ fontSize: 12 }} />
              {tempLayers.map((layer) => (
                <Line key={layer.key} dataKey={layer.key} name={layer.name} stroke={layer.color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel
          title="Humidity"
          subtitle={quietRh.length ? `Ambient movement · ${quietRh.join(', ')} stayed at 0 %` : 'Ambient, inlet, upper, and lower · %RH'}
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartRows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <TimeXAxis rows={chartRows} />
              <YAxis tickLine={false} axisLine={false} width={44} domain={paddedDomain(rhLayers.flatMap((layer) => points.map((point) => point.values[layer.key])))} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => timeLabel(chartRows, value)} formatter={(value: number, name) => [`${fmtNumber(value, 1)} %`, name]} />
              <Legend verticalAlign="top" height={22} wrapperStyle={{ fontSize: 12 }} />
              {rhLayers.map((layer) => (
                <Line key={layer.key} dataKey={layer.key} name={layer.name} stroke={layer.color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Layer snapshot" subtitle="Latest temperature and humidity in the table">
          <div className="grid gap-5 sm:grid-cols-2">
            <LayerBars title="Temperature" unit="°C" decimals={1} layers={TEMP_LAYERS} points={points} />
            <LayerBars title="Humidity" unit="%" decimals={1} layers={RH_LAYERS} points={points} />
          </div>
        </Panel>
        <Panel title="Actuators" subtitle="Position against demand on the latest sample">
          <div className="grid gap-2">
            <PairBar
              label="Hot louver"
              actual={latest(points, 'hot_louver_position_pct')}
              demand={latest(points, 'hot_louver_demand_pct')}
              unit="%"
              color="#f97316"
              decimals={0}
            />
            <PairBar
              label="Ambient louver"
              actual={latest(points, 'amb_louver_position_pct')}
              demand={latest(points, 'amb_louver_demand_pct')}
              unit="%"
              color="#22d3ee"
              decimals={0}
            />
            <PairBar
              label="Chamber pressure"
              actual={latest(points, 'chamber_pressure_pa')}
              demand={latest(points, 'pressure_demand_pa')}
              unit="Pa"
              color="#a78bfa"
              decimals={1}
            />
          </div>
        </Panel>
      </div>

      <Panel title="Fan and chamber pressure" subtitle={span}>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartRows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <TimeXAxis rows={chartRows} />
            <YAxis yAxisId="fan" tickLine={false} axisLine={false} width={44} domain={['auto', 'auto']} />
            <YAxis yAxisId="pa" orientation="right" tickLine={false} axisLine={false} width={44} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(value) => timeLabel(chartRows, value)}
              formatter={(value: number, name) => [fmtNumber(value, 1), name]}
            />
            <Legend verticalAlign="top" height={22} wrapperStyle={{ fontSize: 12 }} />
            <Line yAxisId="fan" dataKey="fan_speed_hz" name="Fan Hz" stroke="#4ade80" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            <Line yAxisId="pa" dataKey="chamber_pressure_pa" name="Chamber Pa" stroke="#a78bfa" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            <Line yAxisId="fan" dataKey="hot_louver_position_pct" name="Hot louver %" stroke="#f97316" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
            <Line yAxisId="fan" dataKey="amb_louver_position_pct" name="Amb louver %" stroke="#22d3ee" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}
