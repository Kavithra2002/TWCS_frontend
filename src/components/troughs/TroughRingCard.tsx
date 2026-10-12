'use client';

import { ChevronRight, Droplets, Thermometer, Wind } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { getPhase, type SimTroughState, type TroughPhase } from '@/contexts/SimulatorContext';
import { fmtNumber } from '@/lib/format';

// ── Theme detection ────────────────────────────────────────────────────────────
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

// ── Dual ring (sized so the value block sits cleanly in the centre hole) ───────
const R_OUT = 34, S_OUT = 5.5;
const R_IN  = 24, S_IN  = 4;
const C_OUT = 2 * Math.PI * R_OUT;
const C_IN  = 2 * Math.PI * R_IN;
const SIZE  = (R_OUT + S_OUT) * 2 + 2;
const CX    = SIZE / 2;

const ARC_OUTER = '#22c55e';
const ARC_INNER = '#0ea5e9';

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
  const uid = useId().replace(/:/g, '');
  const witherPct = Math.min(100, Math.max(0, ((100 - ws) / (100 - targetWs)) * 100));
  const timePct   = totalH > 0 ? Math.min(100, (elapsedH / totalH) * 100) : 0;

  const outerOffset = C_OUT - (witherPct / 100) * C_OUT;
  const innerOffset = C_IN  - (timePct  / 100) * C_IN;

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
      <defs>
        <filter id={`sh-${uid}`} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.3)" />
        </filter>
      </defs>

      <circle cx={CX} cy={CX} r={R_OUT} fill="none" stroke={trackColor} strokeWidth={S_OUT} />
      <circle
        cx={CX} cy={CX} r={R_OUT} fill="none"
        stroke={ARC_OUTER} strokeWidth={S_OUT}
        strokeDasharray={`${C_OUT} ${C_OUT}`}
        strokeDashoffset={started ? outerOffset : C_OUT}
        strokeLinecap="round"
        transform={`rotate(-90 ${CX} ${CX})`}
        opacity={started ? (running ? 1 : 0.75) : 0}
        filter={`url(#sh-${uid})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease, opacity 0.3s' }}
      />

      <circle cx={CX} cy={CX} r={R_IN} fill="none" stroke={trackInnerColor} strokeWidth={S_IN} />
      <circle
        cx={CX} cy={CX} r={R_IN} fill="none"
        stroke={ARC_INNER} strokeWidth={S_IN}
        strokeDasharray={`${C_IN} ${C_IN}`}
        strokeDashoffset={started ? innerOffset : C_IN}
        strokeLinecap="round"
        transform={`rotate(-90 ${CX} ${CX})`}
        opacity={started ? (running ? 0.95 : 0.55) : 0}
        style={{ transition: 'stroke-dashoffset 0.6s ease, opacity 0.3s' }}
      />
    </svg>
  );
}

// ── Phase / status styles ─────────────────────────────────────────────────────
const PHASE_STYLE: Record<TroughPhase, { color: string; bg: string }> = {
  SMR:  { color: '#38bdf8', bg: 'rgba(56,189,248,0.15)'  },
  IMR1: { color: '#4ade80', bg: 'rgba(74,222,128,0.15)'  },
  LTO:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  IMR2: { color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)'  },
  DONE: { color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
};

type CardStatus = 'running' | 'paused' | 'done' | 'ready';

function resolveStatus(running: boolean, started: boolean, phase: TroughPhase | null): CardStatus {
  if (running) return 'running';
  if (phase === 'DONE') return 'done';
  if (started) return 'paused';
  return 'ready';
}

const STATUS_META: Record<CardStatus, { label: string; accent: string }> = {
  running: { label: 'Running', accent: '#22c55e' },
  paused:  { label: 'Paused',  accent: '#f59e0b' },
  done:    { label: 'Done',    accent: '#64748b' },
  ready:   { label: 'Ready',   accent: '#94a3b8' },
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

  const trackColor      = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)';
  const trackInnerColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';

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
  const status  = resolveStatus(running, started, phase);
  const statusMeta = STATUS_META[status];

  const clr = {
    heading:    isDark ? '#f1f5f9' : '#1e293b',
    value:      isDark ? '#f8fafc' : '#0f172a',
    sub:        isDark ? '#94a3b8' : '#64748b',
    muted:      isDark ? '#64748b' : '#94a3b8',
    dimText:    isDark ? '#64748b' : '#94a3b8',
    divider:    isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
    cardBg:     isDark ? 'rgba(6,14,22,0.55)' : 'rgba(255,255,255,0.62)',
    cardBorder: running
      ? (isDark ? 'rgba(34,197,94,0.40)' : 'rgba(34,197,94,0.50)')
      : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.85)',
    statusBg: running
      ? (isDark ? 'rgba(34,197,94,0.16)' : 'rgba(34,197,94,0.12)')
      : status === 'paused'
        ? (isDark ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.12)')
        : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
    statusText: running ? (isDark ? '#4ade80' : '#16a34a')
      : status === 'paused' ? (isDark ? '#fbbf24' : '#d97706')
      : status === 'done'   ? '#64748b'
      : (isDark ? '#94a3b8' : '#64748b'),
    chipBg:     isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)',
    kgUnit:     isDark ? '#94a3b8' : '#64748b',
  };

  const witherPct = started
    ? Math.min(100, Math.round(((100 - ws) / (100 - session.target_ws_pct)) * 100))
    : 0;
  const timePct = totalH > 0 ? Math.min(100, Math.round((elapsedH / totalH) * 100)) : 0;

  const className = `group relative w-full overflow-hidden rounded-xl border text-left transition-all duration-200 ${
    running ? 'running-glow' : 'hover:-translate-y-0.5'
  } ${onView ? 'cursor-pointer' : ''}`;

  const style = {
    backgroundColor: clr.cardBg,
    borderColor: clr.cardBorder,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isDark
      ? '0 2px 4px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)'
      : '0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.95)',
  } as const;

  const body = (
    <>
      {/* Status accent rail */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{
          backgroundColor: statusMeta.accent,
          opacity: status === 'ready' ? 0.4 : 1,
        }}
      />

      <div className="flex items-center gap-2.5 px-3 py-2 pl-3.5">
        {/* Ring — value + label centered as one block in the inner hole */}
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <DualRing
            ws={ws} targetWs={session.target_ws_pct}
            elapsedH={elapsedH} totalH={totalH}
            started={started} running={running}
            trackColor={trackColor} trackInnerColor={trackInnerColor}
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center justify-center text-center leading-none">
              <span
                className="text-[13px] font-bold tabular-nums"
                style={{ color: started ? clr.value : clr.dimText }}
              >
                {started ? `${Math.round(ws)}%` : '—'}
              </span>
              <span
                className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider"
                style={{ color: started ? clr.sub : clr.dimText }}
              >
                {started ? 'WS' : 'Idle'}
              </span>
            </div>
          </div>
        </div>

        {/* Identity + metrics */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-[13px] font-semibold tracking-tight" style={{ color: clr.heading }}>
                Trough {session.trough_number}
              </p>
              <span
                className="shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide"
                style={{ color: clr.sub, backgroundColor: clr.chipBg }}
              >
                {session.airflow_mode}
              </span>
              {phase && phase !== 'DONE' && phStyle && (
                <span
                  className="shrink-0 rounded px-1 py-px text-[9px] font-bold"
                  style={{ color: phStyle.color, backgroundColor: phStyle.bg }}
                >
                  {phase}
                </span>
              )}
            </div>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ color: clr.statusText, backgroundColor: clr.statusBg }}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: statusMeta.accent }}
              />
              {statusMeta.label}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-bold leading-none tabular-nums" style={{ color: started ? clr.value : clr.dimText }}>
              {started ? (
                <>
                  {fmtNumber(weight, 0)}
                  <span className="ml-0.5 text-[10px] font-medium" style={{ color: clr.kgUnit }}>kg</span>
                </>
              ) : (
                '—'
              )}
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: clr.sub }}>
              {started ? (
                <>
                  {session.starting_weight_kg.toLocaleString()} → {session.target_ws_pct}% WS
                  <span style={{ color: clr.muted }}>
                    {' · '}{elapsedH.toFixed(1)}/{totalH.toFixed(1)}h
                  </span>
                </>
              ) : (
                <>target {session.target_ws_pct}% WS</>
              )}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span
              className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums"
              style={{ color: clr.sub, backgroundColor: clr.chipBg }}
            >
              <Thermometer className="h-2.5 w-2.5 text-orange-400" />
              {temp != null ? `${fmtNumber(temp, 1)}°` : '—'}
            </span>
            <span
              className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums"
              style={{ color: clr.sub, backgroundColor: clr.chipBg }}
            >
              <Droplets className="h-2.5 w-2.5 text-sky-400" />
              {rh != null ? `${fmtNumber(rh, 0)}%` : '—'}
            </span>
            <span
              className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums"
              style={{ color: clr.sub, backgroundColor: clr.chipBg }}
            >
              <Wind className="h-2.5 w-2.5 text-green-500" />
              {fanHz != null ? `${fmtNumber(fanHz, 0)}Hz` : '—'}
            </span>

            {started && (
              <>
                <span className="mx-0.5 h-3 w-px" style={{ backgroundColor: clr.divider }} />
                <span className="inline-flex items-center gap-1 text-[10px] tabular-nums" style={{ color: clr.sub }}>
                  <span className="h-1 w-3 rounded-full bg-green-500" />
                  {witherPct}%
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] tabular-nums" style={{ color: clr.sub }}>
                  <span className="h-1 w-3 rounded-full bg-sky-500" />
                  {timePct}%
                </span>
              </>
            )}
          </div>
        </div>

        {onView && (
          <ChevronRight
            className="h-4 w-4 shrink-0 opacity-35 transition group-hover:translate-x-0.5 group-hover:opacity-80"
            style={{ color: clr.sub }}
          />
        )}
      </div>
    </>
  );

  if (onView) {
    return (
      <button type="button" onClick={onView} className={className} style={style}>
        {body}
      </button>
    );
  }

  return (
    <div className={className} style={style}>
      {body}
    </div>
  );
}
