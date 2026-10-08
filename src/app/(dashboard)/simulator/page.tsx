'use client';

import { Droplets, Pause, Play, RotateCcw, Thermometer, Wind, Zap } from 'lucide-react';
import { useState } from 'react';
import { useSimulator, getPhase, type SimTroughState } from '@/contexts/SimulatorContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { fmtNumber } from '@/lib/format';

type Phase = 'SMR' | 'IMR1' | 'LTO' | 'IMR2' | 'DONE';

const PHASE_COLOR: Record<Phase, string> = {
  SMR: 'text-sky-400', IMR1: 'text-green-400',
  LTO: 'text-amber-400', IMR2: 'text-teal-400', DONE: 'text-slate-500',
};

function barColor(ws: number) {
  if (ws >= 70) return '#22c55e';
  if (ws >= 45) return '#f59e0b';
  return '#ef4444';
}

// ── Single trough card ────────────────────────────────────────────────────────

function SimCard({
  t,
  selected,
  onSelect,
  onToggle,
  onClear,
}: {
  t: SimTroughState;
  selected: boolean;
  onSelect: () => void;
  onToggle: (e: React.MouseEvent) => void;
  onClear: (e: React.MouseEvent) => void;
}) {
  const { data, idx, running } = t;
  const { session, events, timeSeries } = data;

  const total = timeSeries.length;
  const point = timeSeries[idx] ?? timeSeries[0];
  const started = running || idx > 0;

  const ws     = point?.current_ws_pct ?? 100;
  const weight = point?.weight_kg ?? session.starting_weight_kg;
  const temp   = point?.upper_temp_c ?? point?.ambient_temp_c ?? null;
  const rh     = point?.upper_rh_pct ?? point?.ambient_rh_pct ?? null;
  const fanHz  = point?.fan_speed_hz ?? null;
  const energy = point?.cumulative_energy_kwh ?? null;

  const phase = started
    ? (getPhase(session, events, point?.timestamp ?? session.session_start) as Phase)
    : null;

  const progressPct = total > 1 ? (idx / (total - 1)) * 100 : 0;
  const isDone = phase === 'DONE' && !running;
  const color = started ? barColor(ws) : '#1e293b';

  const elapsedH = point?.timestamp
    ? Math.round(((Date.parse(point.timestamp) - Date.parse(session.session_start)) / 3_600_000) * 10) / 10
    : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={`cursor-pointer rounded-2xl border transition-all duration-200 ${
        running
          ? 'border-green-500/30 running-glow bg-slate-900'
          : selected
          ? 'border-sky-500/50 bg-slate-900 shadow-md shadow-sky-950/20'
          : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
      }`}
    >
      {/* Top accent line */}
      {(running || selected) && (
        <div className={`h-0.5 rounded-t-2xl ${
          running
            ? 'bg-gradient-to-r from-transparent via-green-500/60 to-transparent'
            : 'bg-gradient-to-r from-transparent via-sky-500/50 to-transparent'
        }`} />
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Selection checkbox visual */}
            <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
              selected || running
                ? running
                  ? 'border-green-500 bg-green-500'
                  : 'border-sky-500 bg-sky-500'
                : 'border-slate-700 bg-transparent'
            }`}>
              {(selected || running) && (
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 2.5L8.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-100">
                Trough {session.trough_number}
              </p>
              <p className="text-[10px] text-slate-600">{session.withering_id}</p>
            </div>
          </div>

          {/* Phase + Run/Stop button */}
          <div className="flex shrink-0 items-center gap-2">
            <span className={`text-[11px] font-bold ${
              phase ? PHASE_COLOR[phase] : 'text-slate-600'
            }`}>
              {phase ?? 'Ready'} <span className="font-normal text-slate-600">| {session.airflow_mode}</span>
            </span>

            {isDone ? (
              <button
                type="button"
                onClick={onClear}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all bg-slate-500/15 text-slate-400 hover:bg-slate-500/25 border border-slate-500/25"
              >
                <RotateCcw className="h-3 w-3" /> Clear
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggle}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  running
                    ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/25'
                    : 'bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/25'
                }`}
              >
                {running
                  ? <><Pause className="h-3 w-3" /> Stop</>
                  : <><Play className="h-3 w-3" /> Run</>
                }
              </button>
            )}
          </div>
        </div>

        {/* Metrics row */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-slate-800/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Wither Std</p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-slate-100">
              {fmtNumber(ws, 1)}<span className="ml-0.5 text-xs font-normal text-slate-500">%</span>
            </p>
          </div>
          <div className="rounded-lg bg-slate-800/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Weight</p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-slate-100">
              {fmtNumber(weight, 0)}<span className="ml-0.5 text-xs font-normal text-slate-500">kg</span>
            </p>
          </div>
        </div>

        {/* Sensor row */}
        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-0.5">
            <Thermometer className="h-3 w-3 text-orange-400/70" />
            {temp != null ? `${fmtNumber(temp, 1)}°C` : '—'}
          </span>
          <span className="flex items-center gap-0.5">
            <Droplets className="h-3 w-3 text-sky-400/70" />
            {rh != null ? `${fmtNumber(rh, 0)}%` : '—'}
          </span>
          <span className="flex items-center gap-0.5">
            <Wind className="h-3 w-3 text-green-400/70" />
            {fanHz != null ? `${fmtNumber(fanHz, 0)} Hz` : '—'}
          </span>
          {energy != null && (
            <span className="ml-auto flex items-center gap-0.5">
              <Zap className="h-3 w-3 text-yellow-400/70" />
              {fmtNumber(energy, 2)} kWh
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-slate-600">
            <span>{Math.round(progressPct)}% complete</span>
            <span>{started ? `${elapsedH}h elapsed · step ${idx + 1}/${total}` : `${session.starting_weight_kg.toLocaleString()} kg start`}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: color }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SimulatorPage() {
  const { state, play, stop, playAll, stopAll, clear } = useSimulator();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const troughList = Object.values(state.troughs);
  const runningCount = troughList.filter((t) => t.running).length;
  const anyRunning = runningCount > 0;
  const selCount = selected.size;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function runSelected() {
    for (const id of selected) play(id);
    setSelected(new Set());
  }

  function stopSelected() {
    for (const id of selected) stop(id);
    setSelected(new Set());
  }

  function selectAll() {
    setSelected(new Set(troughList.map((t) => t.data.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  if (!state.loaded) {
    return (
      <>
        <PageHeader title="Simulator" description="Loading trough datasets…" />
        <div className="flex h-40 items-center justify-center text-slate-500 text-sm">Loading…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Simulator"
        description={`${troughList.length} sessions · ${runningCount} running`}
        actions={
          <div className="flex items-center gap-2">
            {/* Selection actions */}
            {selCount > 0 && (
              <>
                <button
                  type="button"
                  onClick={runSelected}
                  className="flex items-center gap-1.5 rounded-lg border border-green-500/25 bg-green-500/10 px-3 py-1.5 text-sm font-bold text-green-400 transition hover:bg-green-500/20"
                >
                  <Play className="h-3.5 w-3.5" /> Run {selCount}
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-400 transition hover:bg-slate-700"
                >
                  Clear
                </button>
                <div className="h-5 w-px bg-slate-700" />
              </>
            )}

            {selCount === 0 && (
              <button
                type="button"
                onClick={selectAll}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-400 transition hover:bg-slate-700"
              >
                Select All
              </button>
            )}

            {/* Run all / Stop all */}
            <button
              type="button"
              onClick={anyRunning ? stopAll : playAll}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-bold transition ${
                anyRunning
                  ? 'border-amber-500/25 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                  : 'border-green-500/25 bg-green-500/10 text-green-400 hover:bg-green-500/20'
              }`}
            >
              {anyRunning
                ? <><Pause className="h-3.5 w-3.5" /> Stop All</>
                : <><Play className="h-3.5 w-3.5" /> Run All</>
              }
            </button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {troughList.map((t) => (
          <SimCard
            key={t.data.id}
            t={t}
            selected={selected.has(t.data.id)}
            onSelect={() => toggleSelect(t.data.id)}
            onToggle={(e) => {
              e.stopPropagation();
              t.running ? stop(t.data.id) : play(t.data.id);
            }}
            onClear={(e) => {
              e.stopPropagation();
              clear(t.data.id);
            }}
          />
        ))}
      </div>
    </>
  );
}
