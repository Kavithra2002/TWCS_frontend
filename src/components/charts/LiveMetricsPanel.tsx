'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, Droplets, Leaf, Scale, SlidersHorizontal, Thermometer, Wind, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { fmtNumber } from '@/lib/format';
import type { TimeSeriesPoint } from '@/lib/moc-run';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getHistory(
  points: TimeSeriesPoint[],
  mkey: keyof TimeSeriesPoint,
  upToIdx: number,
  maxLen = 40,
): number[] {
  const start = Math.max(0, upToIdx - maxLen + 1);
  const out: number[] = [];
  for (let i = start; i <= upToIdx; i++) {
    const v = points[i][mkey] as number | null;
    if (v != null && Number.isFinite(v)) out.push(v);
  }
  return out;
}

function fmtTs(iso: string): string {
  if (!iso) return '';
  const t = iso.slice(11, 16);
  const [, mon, day] = iso.slice(0, 10).split('-');
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${t}  ·  ${Number(day)} ${months[Number(mon)]}`;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const W = 100, H = 20;
  if (data.length < 2) return <div style={{ height: H }} />;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - 2 - ((v - min) / span) * (H - 4),
  }));
  const linePts = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  // Close the polygon along the bottom edge for the filled area
  const fillPts = [
    ...coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${W},${H}`,
    `0,${H}`,
  ].join(' ');
  const gradId = `sg-${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* filled area */}
      <polygon points={fillPts} fill={`url(#${gradId})`} />
      {/* line on top */}
      <polyline
        points={linePts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
    </svg>
  );
}

// ─── KPI card — matches KpiCard.tsx exactly ───────────────────────────────────

function LiveKpiCard({
  label, value, unit, hint, icon: Icon, color = '#2e9862',
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon: LucideIcon;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}22` }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-50">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ─── Sensor tile — matches SensorTile.tsx style ───────────────────────────────

interface SensorDef {
  mkey: keyof TimeSeriesPoint;
  label: string;
  unit: string;
  dec: number;
  color: string;
  icon: LucideIcon;
}

function LiveSensorTile({
  def,
  curr,
  history,
}: {
  def: SensorDef;
  curr: TimeSeriesPoint;
  history: number[];
}) {
  const { mkey, label, unit, dec, color, icon: Icon } = def;
  const value = curr[mkey] as number | null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 py-2">
      {/* label + dot */}
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          <Icon className="h-3 w-3 shrink-0" style={{ color }} />
          {label}
        </span>
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: value !== null ? color : '#475569' }}
        />
      </div>

      {/* value */}
      <p className="mt-0.5 text-lg font-semibold tabular-nums leading-tight text-slate-50">
        {fmtNumber(value, dec)}
        <span className="ml-0.5 text-[11px] font-normal text-slate-500">{unit}</span>
      </p>

      {/* live sparkline */}
      <div className="mt-1">
        <Sparkline data={history} color={color} />
      </div>
    </div>
  );
}

// ─── Sensor group definitions ─────────────────────────────────────────────────

const ENV_SENSORS: SensorDef[] = [
  { mkey: 'ambient_rh_pct',  label: 'Ambient RH',   unit: '%',  dec: 1, color: '#38bdf8', icon: Droplets    },
  { mkey: 'ambient_temp_c',  label: 'Ambient Temp', unit: '°C', dec: 1, color: '#fb923c', icon: Thermometer },
  { mkey: 'inlet_rh_pct',   label: 'Inlet RH',     unit: '%',  dec: 1, color: '#7dd3fc', icon: Droplets    },
  { mkey: 'inlet_temp_c',   label: 'Inlet Temp',   unit: '°C', dec: 1, color: '#fdba74', icon: Thermometer },
];

const CHAMBER_SENSORS: SensorDef[] = [
  { mkey: 'upper_rh_pct',  label: 'Upper RH',   unit: '%',  dec: 1, color: '#34d399', icon: Droplets    },
  { mkey: 'upper_temp_c',  label: 'Upper Temp', unit: '°C', dec: 1, color: '#6ee7b7', icon: Thermometer },
  { mkey: 'lower_rh_pct',  label: 'Lower RH',   unit: '%',  dec: 1, color: '#10b981', icon: Droplets    },
  { mkey: 'lower_temp_c',  label: 'Lower Temp', unit: '°C', dec: 1, color: '#a7f3d0', icon: Thermometer },
];

const ACTUATOR_SENSORS: SensorDef[] = [
  { mkey: 'fan_speed_hz',            label: 'Fan Speed',      unit: 'Hz', dec: 0, color: '#4ade80', icon: Wind             },
  { mkey: 'hot_louver_position_pct', label: 'Hot Louver Pos', unit: '%',  dec: 0, color: '#f97316', icon: SlidersHorizontal },
  { mkey: 'hot_louver_demand_pct',   label: 'Hot Louver Dem', unit: '%',  dec: 0, color: '#fdba74', icon: SlidersHorizontal },
  { mkey: 'amb_louver_position_pct', label: 'Amb Louver Pos', unit: '%',  dec: 0, color: '#22d3ee', icon: SlidersHorizontal },
  { mkey: 'amb_louver_demand_pct',   label: 'Amb Louver Dem', unit: '%',  dec: 0, color: '#67e8f9', icon: SlidersHorizontal },
];

const PRESSURE_SENSORS: SensorDef[] = [
  { mkey: 'chamber_pressure_pa', label: 'Chamber', unit: 'Pa', dec: 1, color: '#a78bfa', icon: Activity },
  { mkey: 'pressure_demand_pa',  label: 'Demand',  unit: 'Pa', dec: 1, color: '#c4b5fd', icon: Activity },
];

// ─── Playback speed options ───────────────────────────────────────────────────

const SPEEDS = [
  { label: '1×', ms: 1000 },
  { label: '4×', ms: 250 },
  { label: '16×', ms: 65 },
] as const;

// ─── LiveMetricsPanel ─────────────────────────────────────────────────────────

export function LiveMetricsPanel({
  points,
  idx,
  onIdxChange,
}: {
  points: TimeSeriesPoint[];
  idx: number;
  onIdxChange: (i: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  // Keep a ref so the interval callback always sees the latest idx without stale closure.
  const idxRef = useRef(idx);
  idxRef.current = idx;

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        const next = idxRef.current + 1;
        if (next >= points.length) {
          setPlaying(false);
          return;
        }
        onIdxChange(next);
      }, SPEEDS[speedIdx].ms);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [playing, speedIdx, points.length, onIdxChange]);

  const curr = points[idx] ?? points[0];
  const prev = idx > 0 ? points[idx - 1] : null;
  if (!curr) return null;

  const wsPctDelta =
    prev?.current_ws_pct != null && curr.current_ws_pct != null
      ? curr.current_ws_pct - prev.current_ws_pct
      : null;
  const weightDelta =
    prev?.weight_kg != null && curr.weight_kg != null
      ? curr.weight_kg - prev.weight_kg
      : null;

  function hist(mkey: keyof TimeSeriesPoint) {
    return getHistory(points, mkey, idx);
  }

  return (
    <>
      {/* ── Playback controls ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* nav buttons */}
          <button
            type="button"
            title="First"
            onClick={() => { setPlaying(false); onIdxChange(0); }}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 transition"
          >
            ⏮
          </button>
          <button
            type="button"
            title="Step back"
            onClick={() => { setPlaying(false); onIdxChange(Math.max(0, idx - 1)); }}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 transition"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="rounded border border-slate-600 bg-slate-700 px-3 py-1 text-sm font-semibold text-slate-100 hover:bg-slate-600 transition min-w-[5rem]"
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            type="button"
            title="Step forward"
            onClick={() => { setPlaying(false); onIdxChange(Math.min(points.length - 1, idx + 1)); }}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 transition"
          >
            ▶
          </button>
          <button
            type="button"
            title="Last"
            onClick={() => { setPlaying(false); onIdxChange(points.length - 1); }}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 transition"
          >
            ⏭
          </button>

          {/* speed */}
          <div className="flex items-center gap-1 ml-1">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 mr-0.5">Speed</span>
            {SPEEDS.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setSpeedIdx(i)}
                className="rounded px-2 py-0.5 text-[11px] font-semibold transition"
                style={
                  speedIdx === i
                    ? { background: '#334155', color: '#e2e8f0', border: '1px solid #475569' }
                    : { background: 'transparent', color: '#64748b', border: '1px solid transparent' }
                }
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* timestamp + counter */}
          <div className="ml-auto text-right">
            <span className="block text-sm font-semibold tabular-nums text-slate-100">
              {fmtTs(curr.timestamp)}
            </span>
            <span className="text-[10px] text-slate-500">
              step {idx + 1} / {points.length}
            </span>
          </div>
        </div>

        {/* slider */}
        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={points.length - 1}
            value={idx}
            onChange={(e) => { setPlaying(false); onIdxChange(Number(e.target.value)); }}
            className="w-full cursor-pointer"
            style={{ accentColor: '#38bdf8' }}
          />
          <div className="flex justify-between text-[9px] text-slate-600 select-none -mt-0.5 px-0.5">
            <span>{points[0]?.timestamp.slice(11, 16)}</span>
            <span>{points[Math.floor(points.length / 4)]?.timestamp.slice(11, 16)}</span>
            <span>{points[Math.floor(points.length / 2)]?.timestamp.slice(11, 16)}</span>
            <span>{points[Math.floor((points.length * 3) / 4)]?.timestamp.slice(11, 16)}</span>
            <span>{points[points.length - 1]?.timestamp.slice(11, 16)}</span>
          </div>
        </div>
      </div>

      {/* ── KPI summary row ─────────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <LiveKpiCard
          label="Wither Std"
          value={fmtNumber(curr.current_ws_pct, 2)}
          unit="%"
          icon={Leaf}
          color="#2e9862"
          hint={wsPctDelta != null && Math.abs(wsPctDelta) > 0.001 ? `${wsPctDelta > 0 ? '▲' : '▼'} ${Math.abs(wsPctDelta).toFixed(2)} this step` : undefined}
        />
        <LiveKpiCard
          label="Weight"
          value={fmtNumber(curr.weight_kg, 0)}
          unit="kg"
          icon={Scale}
          color="#4ade80"
          hint={weightDelta != null && Math.abs(weightDelta) > 0.05 ? `${weightDelta > 0 ? '▲' : '▼'} ${Math.abs(weightDelta).toFixed(1)} kg this step` : undefined}
        />
        <LiveKpiCard
          label="Fan Speed"
          value={fmtNumber(curr.fan_speed_hz, 0)}
          unit="Hz"
          icon={Wind}
          color="#38bdf8"
        />
        <LiveKpiCard
          label="Chamber Press."
          value={fmtNumber(curr.chamber_pressure_pa, 1)}
          unit="Pa"
          icon={Activity}
          color="#a78bfa"
          hint={curr.pressure_demand_pa != null ? `Demand ${fmtNumber(curr.pressure_demand_pa, 1)} Pa` : undefined}
        />
        <LiveKpiCard
          label="Cumul. Energy"
          value={fmtNumber(curr.cumulative_energy_kwh, 3)}
          unit="kWh"
          icon={Zap}
          color="#facc15"
        />
        <LiveKpiCard
          label="Amb. Louver"
          value={fmtNumber(curr.amb_louver_position_pct, 0)}
          unit="%"
          icon={SlidersHorizontal}
          color="#22d3ee"
          hint={`Demand ${fmtNumber(curr.amb_louver_demand_pct, 0)}%`}
        />
      </div>

      {/* ── Sensor groups ───────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title="Environment" subtitle="Ambient & inlet conditions">
          <div className="grid grid-cols-2 gap-3">
            {ENV_SENSORS.map((s) => (
              <LiveSensorTile key={s.mkey} def={s} curr={curr} history={hist(s.mkey)} />
            ))}
          </div>
        </Card>

        <Card title="Chamber" subtitle="Upper & lower layer conditions">
          <div className="grid grid-cols-2 gap-3">
            {CHAMBER_SENSORS.map((s) => (
              <LiveSensorTile key={s.mkey} def={s} curr={curr} history={hist(s.mkey)} />
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title="Actuators" subtitle="Fan & louver positions vs demand">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {ACTUATOR_SENSORS.map((s) => (
              <LiveSensorTile key={s.mkey} def={s} curr={curr} history={hist(s.mkey)} />
            ))}
          </div>
        </Card>

        <Card title="Pressure" subtitle="Chamber pressure & demand">
          <div className="grid grid-cols-2 gap-3">
            {PRESSURE_SENSORS.map((s) => (
              <LiveSensorTile key={s.mkey} def={s} curr={curr} history={hist(s.mkey)} />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
