'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { getPhase } from '@/contexts/SimulatorContext';
import { useVisibleSimTroughs } from '@/hooks/useTroughAccess';
import { LiveMetricsPanel } from '@/components/charts/LiveMetricsPanel';
import { WitherWeightChart } from '@/components/charts/WitherWeightChart';
import { WitherRunTable } from '@/components/charts/WitherRunTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Loading } from '@/components/ui/States';
import { fmtNumber } from '@/lib/format';
import type { TimeSeriesPoint, WitherSnapshotPoint } from '@/lib/moc-run';
import type { SimPoint, SimTroughData } from '@/lib/sim-data';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Blank point so KPI / sensor cards render with empty (—) values. */
const EMPTY_POINT: TimeSeriesPoint = {
  timestamp: '',
  ambient_rh_pct: null,
  ambient_temp_c: null,
  inlet_rh_pct: null,
  inlet_temp_c: null,
  upper_rh_pct: null,
  upper_temp_c: null,
  lower_rh_pct: null,
  lower_temp_c: null,
  chamber_pressure_pa: null,
  pressure_demand_pa: null,
  fan_speed_hz: null,
  hot_louver_position_pct: null,
  hot_louver_demand_pct: null,
  amb_louver_position_pct: null,
  amb_louver_demand_pct: null,
  cumulative_energy_kwh: null,
  current_ws_pct: null,
  weight_kg: null,
};

function toTimeSeriesPoints(timeSeries: SimPoint[]): TimeSeriesPoint[] {
  return timeSeries as unknown as TimeSeriesPoint[];
}

function toChartPoints(timeSeries: SimPoint[], session: SimTroughData['session']): WitherSnapshotPoint[] {
  const startMs = Date.parse(session.session_start);
  return timeSeries.map((p) => ({
    file: p.timestamp,
    hour: Math.round(((Date.parse(p.timestamp) - startMs) / 3_600_000) * 100) / 100,
    weightKg: p.weight_kg ?? Math.round(session.starting_weight_kg * ((p.current_ws_pct ?? 100) / 100) * 10) / 10,
    wsPct: p.current_ws_pct ?? 100,
    fanHz: p.fan_speed_hz,
    hotLouverPct: p.hot_louver_position_pct,
    ambLouverPct: p.amb_louver_position_pct,
  }));
}

function surfaceEndHourFrom(session: SimTroughData['session']): number {
  return Math.round(((Date.parse(session.imr1_start) - Date.parse(session.session_start)) / 3_600_000) * 100) / 100;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LiveMonitoringPage() {
  const { troughs, ready, restricted } = useVisibleSimTroughs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = troughs.find((trough) => trough.data.id === selectedId) ?? troughs[0];

  if (!ready) {
    return (
      <>
        <PageHeader title="Live Monitoring" description="Real-time withering data" />
        <Loading label="Loading simulator data…" />
      </>
    );
  }

  if (!selected) {
    return (
      <>
        <PageHeader
          title="Live Monitoring"
          description={restricted ? 'No troughs are assigned to this account' : 'Real-time withering data'}
        />
        <p className="mt-8 text-center text-slate-500">
          {restricted ? 'Ask a Super admin to assign troughs in Users.' : 'No trough data available.'}
        </p>
      </>
    );
  }

  const { data, idx, running } = selected;
  const { session, timeSeries } = data;
  const started = running || idx > 0;

  const phase = started
    ? getPhase(session, data.events, timeSeries[idx]?.timestamp ?? session.session_start)
    : null;

  const allChartPoints  = toChartPoints(timeSeries, session);
  const visibleChart    = allChartPoints.slice(0, idx + 1);
  const surfaceEndHour  = surfaceEndHourFrom(session);
  const maxHour         = allChartPoints.at(-1)?.hour ?? 14;

  const allWeights = allChartPoints.map((p) => p.weightKg).filter((weight) => Number.isFinite(weight));
  const wMin = allWeights.length ? Math.min(...allWeights) : 0;
  const wMax = allWeights.length ? Math.max(...allWeights) : 1;
  const pad  = (wMax - wMin) * 0.04;
  const yDomain: [number, number] = [Math.floor(wMin - pad), Math.ceil(wMax + pad)];

  const ts  = timeSeries[idx] ?? timeSeries[0];
  const elapsedH = ts
    ? Math.round(((Date.parse(ts.timestamp) - Date.parse(session.session_start)) / 3_600_000) * 10) / 10
    : 0;
  const totalH = Math.round(
    ((Date.parse(session.session_end) - Date.parse(session.session_start)) / 3_600_000) * 10,
  ) / 10;

  return (
    <>
      <PageHeader
        title="Live Monitoring"
        description={`Trough ${session.trough_number} · ${session.airflow_mode} · ${session.starting_weight_kg.toLocaleString()} kg start`}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {troughs.map((trough) => {
          const number = trough.data.session.trough_number;
          const active = trough.data.id === selected.data.id;
          return (
            <button
              key={trough.data.id}
              type="button"
              onClick={() => setSelectedId(trough.data.id)}
              className={clsx(
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                active
                  ? 'border-tea-500 bg-tea-600/15 text-tea-700'
                  : 'border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500',
              )}
            >
              Trough {number}
            </button>
          );
        })}
      </div>

      {/* Status banner */}
      <div className={`mb-4 flex items-center justify-between rounded-xl border px-4 py-3 ${
        running
          ? 'border-green-500/25 bg-green-500/8'
          : started
          ? 'border-amber-500/20 bg-amber-500/6'
          : 'border-slate-700 bg-slate-900/40'
      }`}>
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${
            running ? 'animate-pulse bg-green-400' : started ? 'bg-amber-400' : 'bg-slate-600'
          }`} />
          <div>
            <p className="text-sm font-semibold text-slate-100">
              {running ? 'Running' : started ? 'Paused' : 'Ready — not yet started'}
            </p>
            <p className="text-[11px] text-slate-500">
              {started
                ? `Step ${idx + 1} / ${timeSeries.length} · ${elapsedH} h elapsed · ${totalH} h total`
                : `Start this trough in the Simulator to see live data`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-right">
          {phase && (
            <span className="rounded-md bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[11px] font-bold text-sky-400">
              {phase}
            </span>
          )}
          {started && (
            <div>
              <p className="text-sm font-bold tabular-nums text-slate-100">
                {fmtNumber(ts?.current_ws_pct, 2)} <span className="text-xs font-normal text-slate-400">% WS</span>
              </p>
              <p className="text-[11px] text-slate-500">
                {fmtNumber(ts?.weight_kg, 0)} kg current
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Always show the monitoring layout; values stay empty until the trough has started */}
      <LiveMetricsPanel
        points={started ? toTimeSeriesPoints(timeSeries) : [EMPTY_POINT]}
        idx={started ? idx : 0}
        showControls={false}
      />
      <div className="mt-4">
        <WitherWeightChart
          points={started ? visibleChart : []}
          allPoints={started ? allChartPoints : []}
          surfaceEndHour={surfaceEndHour}
          maxHour={maxHour}
          yDomain={started ? yDomain : [0, 1]}
        />
      </div>
      <div className="mt-4">
        <WitherRunTable points={started ? visibleChart : []} surfaceEndHour={surfaceEndHour} />
      </div>
    </>
  );
}
