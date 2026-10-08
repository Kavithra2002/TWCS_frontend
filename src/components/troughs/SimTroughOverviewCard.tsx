'use client';

import type { ElementType } from 'react';
import { Droplets, Thermometer, Wind } from 'lucide-react';
import { getPhase, type SimTroughState } from '@/contexts/SimulatorContext';
import { fmtNumber } from '@/lib/format';

// ── Compact offline row ───────────────────────────────────────────────────────
export function SimTroughOfflineRow({ troughState }: { troughState: SimTroughState }) {
  const { data, idx } = troughState;
  const { session } = data;
  const paused = idx > 0;

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors ${
      paused
        ? 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10'
        : 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10'
    }`}>
      {/* Status dot */}
      <span className={`h-2 w-2 shrink-0 rounded-full ${paused ? 'bg-amber-500' : 'bg-red-500'}`} />

      {/* Name */}
      <span className={`w-20 shrink-0 text-sm font-semibold ${paused ? 'text-amber-400' : 'text-red-400'}`}>
        Trough {session.trough_number}
      </span>

      {/* Meta */}
      <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
        {session.airflow_mode} · {session.starting_weight_kg.toLocaleString()} kg · target {session.target_ws_pct}% WS
      </span>

      {/* Badge */}
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        paused
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          : 'border-red-500/30 bg-red-500/10 text-red-400'
      }`}>
        {paused ? 'Paused' : 'Offline'}
      </span>
    </div>
  );
}

// ── Full running card ─────────────────────────────────────────────────────────
export function SimTroughRunningCard({ troughState }: { troughState: SimTroughState }) {
  const { data, idx, running } = troughState;
  const { session, events, timeSeries } = data;

  const started = running || idx > 0;
  const point = timeSeries[idx] ?? timeSeries[0];

  const ws    = point?.current_ws_pct ?? 100;
  const weight = point?.weight_kg     ?? session.starting_weight_kg;
  const temp   = point?.upper_temp_c  ?? point?.ambient_temp_c ?? null;
  const rh     = point?.upper_rh_pct  ?? point?.ambient_rh_pct ?? null;
  const fanHz  = point?.fan_speed_hz  ?? null;

  const elapsedH = point?.timestamp
    ? Math.round(((Date.parse(point.timestamp) - Date.parse(session.session_start)) / 3_600_000) * 10) / 10
    : 0;
  const totalH = Math.round(
    ((Date.parse(session.session_end) - Date.parse(session.session_start)) / 3_600_000) * 10,
  ) / 10;

  const phase = started
    ? getPhase(session, events, point?.timestamp ?? session.session_start)
    : null;

  const progressPct = timeSeries.length > 1
    ? Math.round((idx / (timeSeries.length - 1)) * 100)
    : 0;

  const accentColor = running ? '#22c55e' : '#f59e0b';

  return (
    <div className={`rounded-xl border p-4 transition-all duration-300 ${
      running
        ? 'running-glow border-green-500/30 bg-slate-900'
        : 'border-amber-500/20 bg-slate-900/80'
    }`}>
      {/* Top accent line */}
      {running && (
        <div className="mb-3 h-px rounded-full bg-gradient-to-r from-transparent via-green-400/40 to-transparent" />
      )}

      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-100">Trough {session.trough_number}</p>
          <p className="text-xs text-slate-400">{session.airflow_mode} · {elapsedH} / {totalH} h</p>
        </div>
        <div className="flex items-center gap-1.5">
          {phase && (
            <span className="rounded-md bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-400">
              {phase}
            </span>
          )}
          {running ? (
            <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Running
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[11px] text-amber-400">
              Paused
            </span>
          )}
        </div>
      </div>

      {/* Sensor tiles */}
      <div className="grid grid-cols-2 gap-2">
        <Tile icon={Thermometer} iconCls="text-orange-400" label="Air temp"
          value={temp != null ? `${fmtNumber(temp, 1)} °C` : '—'} />
        <Tile icon={Droplets}    iconCls="text-sky-400"    label="Humidity"
          value={rh   != null ? `${fmtNumber(rh, 0)} %RH`  : '—'} />
        <Tile icon={Wind}        iconCls="text-green-500"  label="Fan"
          value={fanHz != null ? `${fmtNumber(fanHz, 0)} Hz` : '—'} />
        <Tile icon={null}        iconCls=""                label="WS now"
          value={`${fmtNumber(ws, 1)} %`} />
      </div>

      {/* Progress */}
      <div className="mt-3 border-t border-slate-800 pt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
          <span>
            {session.starting_weight_kg.toLocaleString()} kg → {session.target_ws_pct}% WS
          </span>
          <span className="tabular-nums font-medium" style={{ color: accentColor }}>
            {progressPct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%`, backgroundColor: accentColor }}
          />
        </div>
        <p className="mt-1 text-[10px] text-slate-600">
          {fmtNumber(weight, 0)} kg current · {fmtNumber(session.starting_weight_kg - weight, 0)} kg moisture lost
        </p>
      </div>
    </div>
  );
}

// ── Sensor tile ───────────────────────────────────────────────────────────────
function Tile({ icon: Icon, iconCls, label, value }: {
  icon: ElementType | null; iconCls: string; label: string; value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] text-slate-500">
        {Icon && <Icon className={`h-3 w-3 ${iconCls}`} />}
        {label}
      </div>
      <p className="mt-0.5 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
