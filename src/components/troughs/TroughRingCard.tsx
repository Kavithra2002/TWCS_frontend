'use client';

import { Droplets, Thermometer, Wind } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPhase, type SimTroughState, type TroughPhase } from '@/contexts/SimulatorContext';
import { fmtNumber } from '@/lib/format';

// ── Theme detection ────────────────────────────────────────────────────────────
// App uses html.light for light mode; dark is the default (no class).
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

// ── Ring constants ─────────────────────────────────────────────────────────────
const R_OUT = 56, S_OUT = 10;
const R_IN  = 41, S_IN  = 7;
const C_OUT = 2 * Math.PI * R_OUT;
const C_IN  = 2 * Math.PI * R_IN;
const SIZE  = (R_OUT + S_OUT) * 2 + 4;
const CX    = SIZE / 2;

// Fixed ring colors — consistent across all troughs
const ARC_OUTER = '#22c55e';
const ARC_INNER = '#0ea5e9';

// ── Dual ring SVG ─────────────────────────────────────────────────────────────
interface RingProps {
  ws: number;
  targetWs: number;
  elapsedH: number;
  totalH: number;
  started: boolean;
  running: boolean;
  trackColor: string;
  trackInnerColor: string;
}

function DualRing({
  ws, targetWs, elapsedH, totalH,
  started, running, trackColor, trackInnerColor,
}: RingProps) {
  const witherPct = Math.min(100, Math.max(0, ((100 - ws) / (100 - targetWs)) * 100));
  const timePct   = totalH > 0 ? Math.min(100, (elapsedH / totalH) * 100) : 0;

  const outerOffset = C_OUT - (witherPct / 100) * C_OUT;
  const innerOffset = C_IN  - (timePct  / 100) * C_IN;

  // 3-D effect IDs — one per SVG instance to avoid collisions
  const shadowId  = `sh-${Math.round(ws * 10)}`;
  const highlightId = `hl-${Math.round(ws * 10)}`;

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
      <defs>
        {/* Directional drop-shadow: depth without any glow/bloom */}
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.45)" floodOpacity="1" />
        </filter>
        {/* Radial gradient for the 3-D highlight on the outer arc */}
        <radialGradient id={highlightId} cx="50%" cy="30%" r="55%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.00)" />
        </radialGradient>
      </defs>

      {/* Outer track — recessed look via inner shadow stripe */}
      <circle cx={CX} cy={CX} r={R_OUT} fill="none" stroke={trackColor} strokeWidth={S_OUT} />
      {/* Outer track inner-edge dark stripe for depth */}
      <circle cx={CX} cy={CX} r={R_OUT} fill="none"
        stroke="rgba(0,0,0,0.18)" strokeWidth={2}
        style={{ pointerEvents: 'none' }}
      />

      {/* Outer arc — wither progress, with drop-shadow for 3-D lift */}
      <circle
        cx={CX} cy={CX} r={R_OUT} fill="none"
        stroke={ARC_OUTER} strokeWidth={S_OUT}
        strokeDasharray={`${C_OUT} ${C_OUT}`}
        strokeDashoffset={started ? outerOffset : C_OUT}
        strokeLinecap="round"
        transform={`rotate(-90 ${CX} ${CX})`}
        opacity={started ? (running ? 1 : 0.80) : 0}
        filter={`url(#${shadowId})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease, opacity 0.3s' }}
      />
      {/* Highlight overlay on outer arc — makes it look convex/raised */}
      <circle
        cx={CX} cy={CX} r={R_OUT} fill="none"
        stroke={`url(#${highlightId})`} strokeWidth={S_OUT - 3}
        strokeDasharray={`${C_OUT} ${C_OUT}`}
        strokeDashoffset={started ? outerOffset : C_OUT}
        strokeLinecap="round"
        transform={`rotate(-90 ${CX} ${CX})`}
        opacity={started ? (running ? 0.6 : 0.35) : 0}
        style={{ transition: 'stroke-dashoffset 0.6s ease, opacity 0.3s', pointerEvents: 'none' }}
      />

      {/* Inner track */}
      <circle cx={CX} cy={CX} r={R_IN} fill="none" stroke={trackInnerColor} strokeWidth={S_IN} />
      {/* Inner arc — time elapsed */}
      <circle
        cx={CX} cy={CX} r={R_IN} fill="none"
        stroke={ARC_INNER} strokeWidth={S_IN}
        strokeDasharray={`${C_IN} ${C_IN}`}
        strokeDashoffset={started ? innerOffset : C_IN}
        strokeLinecap="round"
        transform={`rotate(-90 ${CX} ${CX})`}
        opacity={started ? (running ? 0.9 : 0.55) : 0}
        filter={`url(#${shadowId})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease, opacity 0.3s' }}
      />
    </svg>
  );
}

// ── Phase style map ───────────────────────────────────────────────────────────
const PHASE_STYLE: Record<TroughPhase, { color: string; bg: string }> = {
  SMR:  { color: '#38bdf8', bg: 'rgba(56,189,248,0.15)'  },
  IMR1: { color: '#4ade80', bg: 'rgba(74,222,128,0.15)'  },
  LTO:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  IMR2: { color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)'  },
  DONE: { color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
};

// ── Card ──────────────────────────────────────────────────────────────────────
export function TroughRingCard({
  troughState,
  onView,
}: {
  troughState: SimTroughState;
  onView?: () => void;
}) {
  const { data, idx, running } = troughState;
  const { session, events, timeSeries } = data;
  const isDark = useIsDark();

  // Track rings: clearly visible guide circles in both themes
  const trackColor      = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.10)';
  const trackInnerColor = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.07)';

  // Derive state values BEFORE building clr so statusText can reference them
  const started = running || idx > 0;
  const point   = timeSeries[idx] ?? timeSeries[0];

  const ws     = point?.current_ws_pct ?? 100;
  const weight = point?.weight_kg      ?? session.starting_weight_kg;
  const temp   = point?.upper_temp_c   ?? point?.ambient_temp_c ?? null;
  const rh     = point?.upper_rh_pct   ?? point?.ambient_rh_pct ?? null;
  const fanHz  = point?.fan_speed_hz   ?? null;

  const elapsedH = point?.timestamp
    ? Math.round(((Date.parse(point.timestamp) - Date.parse(session.session_start)) / 3_600_000) * 100) / 100
    : 0;
  const totalH = Math.round(
    ((Date.parse(session.session_end) - Date.parse(session.session_start)) / 3_600_000) * 100,
  ) / 100;

  const phase   = started ? getPhase(session, events, point?.timestamp ?? session.session_start) : null;
  const phStyle = phase ? PHASE_STYLE[phase] : null;

  // Color palette — all values chosen for ≥ 4.5:1 contrast in their mode
  const clr = {
    heading:    isDark ? '#f1f5f9' : '#1e293b',
    value:      isDark ? '#f8fafc' : '#0f172a',
    sub:        isDark ? '#cbd5e1' : '#475569',
    muted:      isDark ? '#94a3b8' : '#64748b',
    dimText:    isDark ? '#64748b' : '#94a3b8',
    divider:    isDark ? '#1e293b' : '#e2e8f0',
    cardBg:     isDark ? '#0f172a' : '#ffffff',
    cardBorder: running
      ? (isDark ? 'rgba(34,197,94,0.30)' : 'rgba(34,197,94,0.40)')
      : isDark ? '#1e293b' : '#e2e8f0',
    statusBg: running
      ? (isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.10)')
      : (isDark ? '#1e293b' : '#f1f5f9'),
    statusText: running          ? (isDark ? '#4ade80' : '#16a34a')
      : phase === 'DONE'         ? '#64748b'
      : started                  ? (isDark ? '#f59e0b' : '#d97706')
      :                            (isDark ? '#94a3b8' : '#64748b'),
    sensorText: isDark ? '#94a3b8' : '#475569',
    kgUnit:     isDark ? '#94a3b8' : '#64748b',
  };

  const witherPct = started
    ? Math.min(100, Math.round(((100 - ws) / (100 - session.target_ws_pct)) * 100))
    : 0;
  const timePct = totalH > 0 ? Math.min(100, Math.round((elapsedH / totalH) * 100)) : 0;

  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-300 ${running ? 'running-glow' : ''}`}
      style={{
        backgroundColor: clr.cardBg,
        borderColor: clr.cardBorder,
      }}
    >
      {/* Animated top accent line when running */}
      {running && (
        <div className="mb-3 h-0.5 rounded-full bg-gradient-to-r from-transparent via-green-400 to-transparent opacity-70" />
      )}

      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold" style={{ color: clr.heading }}>
          Trough {session.trough_number}
        </p>
        <div className="flex items-center gap-1.5">
          {/* Phase badge — only for active process phases, never for DONE */}
          {phase && phase !== 'DONE' && phStyle && (
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-bold"
              style={{ color: phStyle.color, backgroundColor: phStyle.bg }}
            >
              {phase}
            </span>
          )}
          {/* Single status badge */}
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ color: clr.statusText, backgroundColor: clr.statusBg }}
          >
            {running ? '● Running'
              : phase === 'DONE' ? 'Done'
              : started ? 'Paused'
              : 'Ready'}
          </span>
        </div>
      </div>

      {/* Ring + data */}
      <div className="flex items-center gap-4">
        {/* Ring with HTML center text overlay */}
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <DualRing
            ws={ws} targetWs={session.target_ws_pct}
            elapsedH={elapsedH} totalH={totalH}
            started={started} running={running}
            trackColor={trackColor} trackInnerColor={trackInnerColor}
          />
          {/* Center text */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span
              className="text-[17px] font-bold leading-none tabular-nums"
              style={{ color: started ? clr.value : clr.dimText }}
            >
              {started ? `${Math.round(ws)}%` : '–'}
            </span>
            <span
              className="text-[9px] leading-none tracking-wide"
              style={{ color: started ? clr.sub : clr.dimText }}
            >
              {started ? `${elapsedH.toFixed(1)} h` : 'READY'}
            </span>
          </div>
        </div>

        {/* Right-side metrics */}
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-xl font-bold tabular-nums" style={{ color: clr.value }}>
              {fmtNumber(weight, 0)}
              <span className="ml-1 text-xs font-normal" style={{ color: clr.kgUnit }}>kg</span>
            </p>
            <p className="text-[11px]" style={{ color: clr.sub }}>
              {session.starting_weight_kg.toLocaleString()} kg → {session.target_ws_pct}% WS
            </p>
          </div>

          <p className="text-[11px]" style={{ color: clr.sub }}>
            {session.airflow_mode}
            {started && (
              <span style={{ color: clr.muted }}>
                {' · '}{elapsedH.toFixed(1)} / {totalH.toFixed(1)} h
              </span>
            )}
          </p>

          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: clr.sensorText }}>
            <span className="flex items-center gap-0.5">
              <Thermometer className="h-3 w-3 text-orange-400" />
              {temp != null ? `${fmtNumber(temp, 1)}°C` : '—'}
            </span>
            <span className="flex items-center gap-0.5">
              <Droplets className="h-3 w-3 text-sky-400" />
              {rh != null ? `${fmtNumber(rh, 0)}%` : '—'}
            </span>
            <span className="flex items-center gap-0.5">
              <Wind className="h-3 w-3 text-green-500" />
              {fanHz != null ? `${fmtNumber(fanHz, 0)} Hz` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Legend + View button */}
      <div
        className="mt-3 flex items-center pt-2.5"
        style={{ borderTop: `1px solid ${clr.divider}` }}
      >
        {started && (
          <div className="flex items-center gap-3 text-[11px] flex-1" style={{ color: clr.sub }}>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full inline-block bg-green-500" />
              Wither {witherPct}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full inline-block bg-sky-500" />
              Time {timePct}%
            </span>
          </div>
        )}
        {!started && <div className="flex-1" />}
        {onView && (
          <button
            type="button"
            onClick={onView}
            className="rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors"
            style={{
              color: isDark ? '#94a3b8' : '#64748b',
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            }}
          >
            View →
          </button>
        )}
      </div>
    </div>
  );
}
