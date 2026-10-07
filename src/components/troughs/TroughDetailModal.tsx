'use client';

import { X, Thermometer, Droplets, Wind, Gauge, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { getPhase, type SimTroughState, type TroughPhase } from '@/contexts/SimulatorContext';
import { fmtNumber } from '@/lib/format';

// ── Theme ──────────────────────────────────────────────────────────────────────
function useIsDark() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const el = document.documentElement;
    const check = () => setDark(!el.classList.contains('light'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ── Phase timeline ─────────────────────────────────────────────────────────────
const PHASE_STEPS: { phase: TroughPhase; label: string }[] = [
  { phase: 'SMR',  label: 'SMR'  },
  { phase: 'IMR1', label: 'IMR1' },
  { phase: 'LTO',  label: 'LTO'  },
  { phase: 'IMR2', label: 'IMR2' },
  { phase: 'DONE', label: 'Done' },
];
const PHASE_IDX: Record<TroughPhase, number> = { SMR: 0, IMR1: 1, LTO: 2, IMR2: 3, DONE: 4 };

// ── Chart tooltip ──────────────────────────────────────────────────────────────
function ChartTip({ active, payload }: { active?: boolean; payload?: { payload: { h: number; ws: number; weight: number } }[] }) {
  if (!active || !payload?.length) return null;
  const { h, ws, weight } = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400">{h.toFixed(1)} h elapsed</p>
      <p className="mt-0.5 font-bold text-green-400">WS {ws.toFixed(1)}%</p>
      <p className="text-slate-300">{fmtNumber(weight, 0)} kg</p>
    </div>
  );
}

// ── Small sensor card ──────────────────────────────────────────────────────────
function SensorCard({
  label, primary, secondary, icon, accent, panel, text, sub,
}: {
  label: string; primary: string; secondary?: string;
  icon: React.ReactNode; accent: string;
  panel: string; text: string; sub: string;
}) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1" style={{ backgroundColor: panel }}>
      <div className="flex items-center gap-1" style={{ color: sub }}>
        <span style={{ color: accent }}>{icon}</span>
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-bold tabular-nums leading-tight" style={{ color: text }}>{primary}</p>
      {secondary && <p className="text-[11px]" style={{ color: sub }}>{secondary}</p>}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────
export function TroughDetailModal({
  troughState,
  onClose,
}: {
  troughState: SimTroughState;
  onClose: () => void;
}) {
  const isDark = useIsDark();
  const { data, idx, running } = troughState;
  const { session, events, timeSeries } = data;

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const started  = running || idx > 0;
  const point    = timeSeries[idx] ?? timeSeries[0];
  const startMs  = Date.parse(session.session_start);

  const ws       = point?.current_ws_pct ?? 100;
  const weight   = point?.weight_kg ?? session.starting_weight_kg;
  const inletT   = point?.inlet_temp_c   ?? point?.ambient_temp_c  ?? null;
  const inletRH  = point?.inlet_rh_pct   ?? point?.ambient_rh_pct  ?? null;
  const chamberT = point?.upper_temp_c   ?? null;
  const chamberRH= point?.upper_rh_pct   ?? null;
  const fanHz    = point?.fan_speed_hz   ?? null;
  const pressurePa = point?.chamber_pressure_pa ?? null;
  const hotLouver  = point?.hot_louver_position_pct ?? null;
  const ambLouver  = point?.amb_louver_position_pct ?? null;
  const energy     = point?.cumulative_energy_kwh   ?? null;

  const elapsedH = point?.timestamp
    ? Math.round(((Date.parse(point.timestamp) - startMs) / 3_600_000) * 100) / 100
    : 0;
  const totalH = Math.round(
    ((Date.parse(session.session_end) - startMs) / 3_600_000) * 100,
  ) / 100;
  const remainH = Math.max(0, totalH - elapsedH);

  const phase    = started ? getPhase(session, events, point?.timestamp ?? session.session_start) : null;
  const phaseIdx = phase ? PHASE_IDX[phase] : -1;

  const witherPct = started
    ? Math.min(100, Math.round(((100 - ws) / (100 - session.target_ws_pct)) * 100))
    : 0;
  const targetWeight = Math.round(session.starting_weight_kg * session.target_ws_pct / 100);

  // Status
  const statusLabel = running ? '● Running'
    : phase === 'DONE' ? 'Done'
    : started ? 'Paused' : 'Ready';
  const statusColor = running ? '#4ade80'
    : phase === 'DONE' ? '#64748b'
    : started ? '#f59e0b' : '#94a3b8';

  // Chart data — sample to max ~150 points
  const slice = timeSeries.slice(0, idx + 1);
  const step  = Math.max(1, Math.floor(slice.length / 150));
  const chartData = slice
    .filter((_, i) => i % step === 0 || i === idx)
    .map((p) => ({
      h:      Math.round(((Date.parse(p.timestamp) - startMs) / 3_600_000) * 10) / 10,
      ws:     p.current_ws_pct ?? 100,
      weight: p.weight_kg ?? 0,
    }));

  // Theme palette
  const bg      = isDark ? '#0f172a' : '#ffffff';
  const surface = isDark ? '#1e293b' : '#f8fafc';
  const panel   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const border  = isDark ? '#1e293b' : '#e2e8f0';
  const text    = isDark ? '#f1f5f9' : '#1e293b';
  const sub     = isDark ? '#94a3b8' : '#64748b';
  const gridClr = isDark ? '#1e293b' : '#f1f5f9';

  const ringR = 52, ringC = 64, ringSize = 128;
  const ringCircumference = 2 * Math.PI * ringR;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative my-8 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: bg, border: `1px solid ${border}` }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-start justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${border}` }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: text }}>
              Trough {session.trough_number}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: sub }}>{session.withering_id}</p>
          </div>
          <div className="flex items-center gap-2">
            {phase && phase !== 'DONE' && (
              <span className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                style={{ color: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.12)' }}>
                {phase}
              </span>
            )}
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{ color: statusColor, backgroundColor: `${statusColor}20` }}>
              {statusLabel}
            </span>
            <button
              onClick={onClose}
              className="ml-1 rounded-lg p-1.5 transition-colors hover:bg-slate-700/30"
              style={{ color: sub }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pb-5 pt-4 space-y-5">

          {/* ── Phase timeline ── */}
          <div className="flex items-start">
            {PHASE_STEPS.map((s, i) => {
              const completed = phaseIdx > i;
              const active    = phaseIdx === i;
              return (
                <div key={s.phase} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold border-2 transition-all duration-300"
                      style={{
                        backgroundColor: completed || active ? '#22c55e' : surface,
                        borderColor:     completed || active ? '#22c55e' : border,
                        color:           completed || active ? '#fff' : sub,
                        boxShadow:       active ? '0 0 0 3px rgba(34,197,94,0.20)' : 'none',
                      }}
                    >
                      {completed ? '✓' : active ? '●' : i + 1}
                    </div>
                    <span className="text-[9px] font-medium leading-none text-center"
                      style={{ color: active ? '#22c55e' : completed ? '#4ade80' : sub }}>
                      {s.label}
                    </span>
                  </div>
                  {i < PHASE_STEPS.length - 1 && (
                    <div className="h-0.5 flex-1 -mx-0.5 -mt-3 transition-colors duration-300"
                      style={{ backgroundColor: completed ? '#22c55e' : border }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Ring + stats ── */}
          <div className="grid grid-cols-5 gap-4">
            {/* Ring */}
            <div className="col-span-2 rounded-xl p-4 flex flex-col items-center justify-center gap-2"
              style={{ backgroundColor: surface }}>
              <div className="relative" style={{ width: ringSize, height: ringSize }}>
                <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`} aria-hidden>
                  <defs>
                    <filter id="dp-modal" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.40)" floodOpacity="1" />
                    </filter>
                    <radialGradient id="hl-modal" cx="50%" cy="30%" r="55%">
                      <stop offset="0%"   stopColor="rgba(255,255,255,0.30)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.00)" />
                    </radialGradient>
                  </defs>
                  {/* Track */}
                  <circle cx={ringC} cy={ringC} r={ringR} fill="none"
                    stroke={isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}
                    strokeWidth={13} />
                  {/* Arc */}
                  <circle cx={ringC} cy={ringC} r={ringR} fill="none"
                    stroke="#22c55e" strokeWidth={13}
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringCircumference * (1 - witherPct / 100)}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${ringC} ${ringC})`}
                    filter="url(#dp-modal)"
                    opacity={started ? 1 : 0}
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                  {/* Highlight */}
                  <circle cx={ringC} cy={ringC} r={ringR} fill="none"
                    stroke="url(#hl-modal)" strokeWidth={10}
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringCircumference * (1 - witherPct / 100)}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${ringC} ${ringC})`}
                    opacity={started ? 0.55 : 0}
                    style={{ transition: 'stroke-dashoffset 0.6s ease', pointerEvents: 'none' }}
                  />
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums" style={{ color: text }}>
                    {started ? `${Math.round(ws)}%` : '–'}
                  </span>
                  <span className="text-[10px] mt-0.5" style={{ color: sub }}>
                    {started ? 'Wither Std' : 'READY'}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-center" style={{ color: sub }}>
                {session.airflow_mode} · {session.starting_weight_kg.toLocaleString()} kg start
              </p>
            </div>

            {/* Stats */}
            <div className="col-span-3 grid grid-cols-1 gap-2">
              {[
                { label: 'Time Elapsed',    value: `${elapsedH.toFixed(1)} / ${totalH.toFixed(1)} h` },
                { label: 'Time Remaining',  value: remainH > 0 ? `${remainH.toFixed(1)} h` : 'Complete' },
                { label: 'Current Weight',  value: `${fmtNumber(weight, 0)} kg` },
                { label: 'Target Weight',   value: `${fmtNumber(targetWeight, 0)} kg` },
                { label: 'Wither Progress', value: `${witherPct}%` },
              ].map(({ label, value }) => (
                <div key={label}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ backgroundColor: panel }}>
                  <span className="text-[11px]" style={{ color: sub }}>{label}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: text }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── WS% chart ── */}
          {chartData.length > 1 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: sub }}>
                Withering Standard (%) over time
              </p>
              <div className="rounded-xl overflow-hidden py-2" style={{ backgroundColor: surface }}>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wsGrad-modal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.30} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridClr} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="h" tick={{ fontSize: 10, fill: sub }}
                      tickFormatter={(v) => `${v}h`}
                      axisLine={false} tickLine={false} />
                    <YAxis domain={[Math.max(0, session.target_ws_pct - 5), 101]}
                      tick={{ fontSize: 10, fill: sub }}
                      tickFormatter={(v) => `${v}%`}
                      axisLine={false} tickLine={false} width={34} />
                    <Tooltip content={<ChartTip />} />
                    <ReferenceLine y={session.target_ws_pct}
                      stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1}
                      label={{ value: `${session.target_ws_pct}% target`, fill: '#f59e0b', fontSize: 9, position: 'insideTopRight' }} />
                    <Area dataKey="ws" stroke="#22c55e" strokeWidth={2}
                      fill="url(#wsGrad-modal)" dot={false}
                      activeDot={{ r: 3, fill: '#22c55e', stroke: '#fff', strokeWidth: 1 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Sensors ── */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: sub }}>
              Sensor Readings
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <SensorCard
                label="Inlet Air" icon={<Thermometer className="h-3 w-3" />} accent="#f97316"
                primary={inletT != null ? `${fmtNumber(inletT, 1)}°C` : '—'}
                secondary={inletRH != null ? `${fmtNumber(inletRH, 0)}% RH` : undefined}
                panel={surface} text={text} sub={sub}
              />
              <SensorCard
                label="Chamber" icon={<Droplets className="h-3 w-3" />} accent="#38bdf8"
                primary={chamberT != null ? `${fmtNumber(chamberT, 1)}°C` : '—'}
                secondary={chamberRH != null ? `${fmtNumber(chamberRH, 0)}% RH` : undefined}
                panel={surface} text={text} sub={sub}
              />
              <SensorCard
                label="Fan Speed" icon={<Wind className="h-3 w-3" />} accent="#4ade80"
                primary={fanHz != null ? `${fmtNumber(fanHz, 0)} Hz` : '—'}
                panel={surface} text={text} sub={sub}
              />
              <SensorCard
                label="Pressure" icon={<Gauge className="h-3 w-3" />} accent="#a78bfa"
                primary={pressurePa != null ? `${fmtNumber(pressurePa, 0)} Pa` : '—'}
                panel={surface} text={text} sub={sub}
              />
              <SensorCard
                label="Hot Louver" icon={<span className="text-[10px]">🔥</span>} accent="#f59e0b"
                primary={hotLouver != null ? `${fmtNumber(hotLouver, 0)}%` : '—'}
                panel={surface} text={text} sub={sub}
              />
              <SensorCard
                label="Amb Louver" icon={<span className="text-[10px]">💨</span>} accent="#67e8f9"
                primary={ambLouver != null ? `${fmtNumber(ambLouver, 0)}%` : '—'}
                panel={surface} text={text} sub={sub}
              />
              {energy != null && (
                <SensorCard
                  label="Energy Used" icon={<Zap className="h-3 w-3" />} accent="#facc15"
                  primary={`${fmtNumber(energy, 2)} kWh`}
                  panel={surface} text={text} sub={sub}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
