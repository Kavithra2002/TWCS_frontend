'use client';

import { getPhase, useSimulator } from '@/contexts/SimulatorContext';
import { LiveMetricsPanel } from '@/components/charts/LiveMetricsPanel';
import { WitherWeightChart } from '@/components/charts/WitherWeightChart';
import { WitherRunTable } from '@/components/charts/WitherRunTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Loading } from '@/components/ui/States';
import { fmtNumber } from '@/lib/format';
import type { TimeSeriesPoint, WitherSnapshotPoint } from '@/lib/moc-run';
import type { SimPoint, SimTroughData } from '@/lib/sim-data';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const { state } = useSimulator();

  if (!state.loaded) {
    return (
      <>
        <PageHeader title="Live Monitoring" description="Trough 1 — real-time withering data" />
        <Loading label="Loading simulator data…" />
      </>
    );
  }

  // Find Trough 1 (trough_number === 1) or fall back to the first loaded trough
  const trough1 = Object.values(state.troughs).find((t) => t.data.session.trough_number === 1)
    ?? Object.values(state.troughs)[0];

  if (!trough1) {
    return (
      <>
        <PageHeader title="Live Monitoring" description="Trough 1 — real-time withering data" />
        <p className="mt-8 text-center text-slate-500">No trough data available.</p>
      </>
    );
  }

  const { data, idx, running } = trough1;
  const { session, timeSeries } = data;
  const started = running || idx > 0;

  const phase = started
    ? getPhase(session, data.events, timeSeries[idx]?.timestamp ?? session.session_start)
    : null;

  const allChartPoints  = toChartPoints(timeSeries, session);
  const visibleChart    = allChartPoints.slice(0, idx + 1);
  const surfaceEndHour  = surfaceEndHourFrom(session);
  const maxHour         = allChartPoints.at(-1)?.hour ?? 14;

  const allWeights = allChartPoints.map((p) => p.weightKg);
  const wMin = Math.min(...allWeights);
  const wMax = Math.max(...allWeights);
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

      {started ? (
        <>
          <LiveMetricsPanel
            points={toTimeSeriesPoints(timeSeries)}
            idx={idx}
            showControls={false}
          />
          <WitherWeightChart
            points={visibleChart}
            allPoints={allChartPoints}
            surfaceEndHour={surfaceEndHour}
            maxHour={maxHour}
            yDomain={yDomain}
          />
          <WitherRunTable points={visibleChart} surfaceEndHour={surfaceEndHour} />
        </>
      ) : (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <div className="rounded-full border border-slate-700 bg-slate-900 p-6">
            <span className="text-4xl">🌿</span>
          </div>
          <p className="text-lg font-semibold text-slate-300">Trough 1 is not running</p>
          <p className="text-sm text-slate-500">
            Go to the <a href="/simulator" className="text-tea-400 hover:text-tea-300 underline">Simulator</a> and start Trough 1 to see live monitoring data here.
          </p>
        </div>
      )}
    </>
  );
}
