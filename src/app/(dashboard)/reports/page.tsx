'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { Download, FileDown, Loader2 } from 'lucide-react';
import { SessionHoursChart, type HourSeries } from '@/components/charts/SessionHoursChart';
import { buildReportRows, ReportDataTable } from '@/components/reports/ReportDataTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  DayCalendar,
  isSameCalendarDay,
  rangeBounds,
  singleDayRange,
  type DayRange,
} from '@/components/ui/DayCalendar';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, Loading } from '@/components/ui/States';
import { useSimulator, type SimTroughState } from '@/contexts/SimulatorContext';
import { isLiveTroughId, isSimActive } from '@/lib/live-trough';
import { api, qs } from '@/lib/api';
import { fmtDateTime, fmtNumber } from '@/lib/format';
import { exportReportPdf } from '@/lib/report-pdf';
import { SENSOR_META, SENSOR_ORDER } from '@/lib/sensors';
import type { SimPoint } from '@/lib/sim-data';
import type { Batch, SensorType, SeriesPoint, SeriesResponse, TroughWithLive } from '@/types';

const COMPARE_COLORS = ['#22c55e', '#38bdf8', '#f97316', '#a78bfa', '#facc15', '#fb7185', '#2dd4bf', '#e879f9'];
const MAIN_CHART_H = 320;
const HALF_CHART_H = MAIN_CHART_H / 2;

type SensorTarget = { trough: TroughWithLive; sensor: NonNullable<TroughWithLive['sensors'][number]> };
type SimBind = { trough: TroughWithLive; sim: SimTroughState; sessionEndH: number };

function troughCodeToSimId(code: string): string | null {
  const n = Number(code.replace(/\D/g, ''));
  if (!Number.isFinite(n) || n < 1) return null;
  return `t0${n}`;
}

function sessionEndHours(sim: SimTroughState): number {
  const start = Date.parse(sim.data.session.session_start);
  const end = Date.parse(sim.data.session.session_end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 1;
  return Math.max(1, Math.ceil((end - start) / 3_600_000));
}

function simMetric(point: SimPoint, sensorType: SensorType): number | null {
  switch (sensorType) {
    case 'AIR_TEMPERATURE':
      return point.inlet_temp_c ?? point.ambient_temp_c ?? point.upper_temp_c;
    case 'LEAF_TEMPERATURE':
      return point.upper_temp_c ?? point.lower_temp_c;
    case 'HUMIDITY':
      return point.inlet_rh_pct ?? point.ambient_rh_pct ?? point.upper_rh_pct;
    case 'LEAF_MOISTURE':
      return point.current_ws_pct;
    case 'FAN_SPEED':
      return point.fan_speed_hz;
    case 'LEAF_WEIGHT':
      return point.weight_kg;
    case 'AIRFLOW':
      return point.chamber_pressure_pa != null ? point.chamber_pressure_pa * 10 : null;
    default:
      return null;
  }
}

/** Points from a live/progressed sim run, clipped to the selected view window (hours). */
function simSeriesPoints(t: SimTroughState, sensorType: SensorType, viewHours: number): SeriesPoint[] {
  if (isLiveTroughId(t.data.id)) {
    const series = t.livePoints;
    if (!series.length) return [];
    const startMs = Date.parse(series[0].timestamp);
    const maxMs = viewHours * 3_600_000;
    const out: SeriesPoint[] = [];
    for (const p of series) {
      const elapsed = Date.parse(p.timestamp) - startMs;
      if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > maxMs) continue;
      const v = simMetric(p, sensorType);
      if (v == null) continue;
      out.push({ t: p.timestamp, avg: v, min: v, max: v });
    }
    return out;
  }

  const progressEnd = Math.max(t.idx, t.running ? 1 : 0);
  if (progressEnd <= 0) return [];

  const startMs = Date.parse(t.data.session.session_start);
  const maxMs = viewHours * 3_600_000;
  const out: SeriesPoint[] = [];

  for (let i = 0; i <= progressEnd; i++) {
    const p = t.data.timeSeries[i];
    if (!p) continue;
    const elapsed = Date.parse(p.timestamp) - startMs;
    if (elapsed < 0 || elapsed > maxMs) continue;
    const v = simMetric(p, sensorType);
    if (v == null) continue;
    out.push({ t: p.timestamp, avg: v, min: v, max: v });
  }
  return out;
}

function summarizePoints(points: SeriesPoint[]) {
  if (!points.length) return null;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const p of points) {
    min = Math.min(min, p.min);
    max = Math.max(max, p.max);
    sum += p.avg;
  }
  return { min, max, avg: sum / points.length, samples: points.length };
}

function clipSeriesToHours(points: SeriesPoint[], viewHours: number): SeriesPoint[] {
  if (!points.length) return [];
  const start = Date.parse(points[0].t);
  const maxMs = viewHours * 3_600_000;
  return points.filter((p) => Date.parse(p.t) - start <= maxMs);
}

/** Y domain from full moc/session series so empty axes match trough comparison. */
function yDomainForSensor(sensorType: SensorType, sims: SimBind[]): [number, number] {
  const fallback = SENSOR_META[sensorType].range;
  if (!sims.length) return fallback;
  let min = Infinity;
  let max = -Infinity;
  for (const { sim } of sims) {
    const series = isLiveTroughId(sim.data.id) ? sim.livePoints : sim.data.timeSeries;
    const step = Math.max(1, Math.floor(series.length / 200));
    for (let i = 0; i < series.length; i += step) {
      const v = simMetric(series[i], sensorType);
      if (v == null || !Number.isFinite(v)) continue;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return fallback;
  const pad = Math.max((max - min) * 0.06, 0.5);
  return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
}

const RUN_STATUSES = new Set(['WITHERING', 'COMPLETED', 'ABORTED']);
/** Primary report metric — no sensor dropdown; companions show the rest. */
const REPORT_TYPE: SensorType = 'LEAF_MOISTURE';

export default function ReportsPage() {
  const { data: troughs } = useSWR<TroughWithLive[]>('/troughs');
  const { state: simState } = useSimulator();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const type = REPORT_TYPE;
  const [reportRange, setReportRange] = useState<DayRange>(() => singleDayRange());
  const [exporting, setExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const companionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isToday = reportRange.days.some((d) => isSameCalendarDay(d, new Date()));
  const dayRange = useMemo(() => rangeBounds(reportRange), [reportRange]);

  useEffect(() => {
    if (!initialized && troughs?.length) {
      setSelectedIds([troughs[0].id]);
      setInitialized(true);
    }
  }, [troughs, initialized]);

  const meta = SENSOR_META[type];
  const selectedTroughs = useMemo(
    () => (troughs ?? []).filter((t) => selectedIds.includes(t.id)),
    [troughs, selectedIds],
  );

  const targets = useMemo(
    () =>
      selectedTroughs
        .map((t) => ({ trough: t, sensor: t.sensors.find((s) => s.type === type) }))
        .filter((x): x is SensorTarget => !!x.sensor),
    [selectedTroughs, type],
  );

  const companionTypes = useMemo(() => SENSOR_ORDER.filter((t) => t !== type), [type]);
  const isCompare = targets.length > 1;

  /** All selected troughs that have sim session metadata (for hour bounds). */
  const selectedSims = useMemo(() => {
    return selectedTroughs
      .map((t) => {
        const simId = troughCodeToSimId(t.code);
        const sim = simId ? simState.troughs[simId] : undefined;
        if (!sim) return null;
        return { trough: t, sim, sessionEndH: sessionEndHours(sim) } satisfies SimBind;
      })
      .filter((x): x is SimBind => !!x);
  }, [selectedTroughs, simState.troughs]);

  /** Only troughs that have actually progressed in a run (today / live). */
  const activeSimRuns = useMemo(
    () => selectedSims.filter(({ sim }) => isSimActive(sim)),
    [selectedSims],
  );

  /** Past-day run log — charts only when selected troughs had a session that day. */
  const { data: dayBatches, isLoading: dayBatchesLoading } = useSWR<Batch[]>(
    !isToday
      ? `/batches${qs({ from: dayRange.from, to: dayRange.to, limit: 200 })}`
      : null,
    { keepPreviousData: true, refreshInterval: 3_000 },
  );

  const pastRunTroughIds = useMemo(() => {
    const ids = new Set<string>();
    for (const b of dayBatches ?? []) {
      if (RUN_STATUSES.has(b.status) && selectedIds.includes(b.troughId)) ids.add(b.troughId);
    }
    return ids;
  }, [dayBatches, selectedIds]);

  const pastTargets = useMemo(
    () => targets.filter((t) => pastRunTroughIds.has(t.trough.id)),
    [targets, pastRunTroughIds],
  );

  const troughsHaveRun = isToday ? activeSimRuns.length > 0 : pastRunTroughIds.size > 0;

  /** Full session length — charts always show the complete run (no hour picker). */
  const viewHours = useMemo(() => {
    if (isToday) {
      if (!selectedSims.length) return 14;
      return Math.max(...selectedSims.map((s) => s.sessionEndH), 14);
    }
    return 24;
  }, [isToday, selectedSims]);

  const pastSensorKey = pastTargets.map((t) => t.sensor.id).join(',');
  const { data: pastSeriesRaw, isLoading: pastSeriesLoading } = useSWR(
    !isToday && pastSensorKey
      ? ['report-day-series', type, dayRange.from, dayRange.to, pastSensorKey]
      : null,
    () =>
      Promise.all(
        pastTargets.map((c) =>
          api<SeriesResponse>(
            `/telemetry/series${qs({
              sensorId: c.sensor.id,
              from: dayRange.from,
              to: dayRange.to,
              points: pastTargets.length > 1 ? 150 : 300,
            })}`,
          ),
        ),
      ),
    { keepPreviousData: true },
  );

  const { data: pastCompanions } = useSWR(
    !isToday && pastRunTroughIds.size
      ? ['report-day-companions', dayRange.from, dayRange.to, [...pastRunTroughIds].join(','), companionTypes.join(',')]
      : null,
    async () => {
      const from = dayRange.from;
      const to = dayRange.to;
      const entries = await Promise.all(
        companionTypes.map(async (sensorType) => {
          const typed = selectedTroughs
            .filter((t) => pastRunTroughIds.has(t.id))
            .map((t) => ({ trough: t, sensor: t.sensors.find((s) => s.type === sensorType) }))
            .filter((x): x is SensorTarget => !!x.sensor);
          if (!typed.length) return [sensorType, null] as const;
          const series = await Promise.all(
            typed.map((c) =>
              api<SeriesResponse>(
                `/telemetry/series${qs({
                  sensorId: c.sensor.id,
                  from,
                  to,
                  points: typed.length > 1 ? 100 : 160,
                })}`,
              ),
            ),
          );
          return [sensorType, { targets: typed, series }] as const;
        }),
      );
      return Object.fromEntries(entries) as Partial<
        Record<SensorType, { targets: SensorTarget[]; series: SeriesResponse[] } | null>
      >;
    },
    { keepPreviousData: true },
  );

  const seriesList = useMemo(() => {
    if (isToday) {
      if (!troughsHaveRun) return [] as SeriesResponse[];
      return targets
        .map((target) => {
          const bind = activeSimRuns.find((a) => a.trough.id === target.trough.id);
          if (!bind) return null;
          const capH = Math.min(viewHours, bind.sessionEndH);
          const points = simSeriesPoints(bind.sim, type, capH);
          if (!points.length) return null;
          const summary = summarizePoints(points);
          return {
            sensor: target.sensor,
            from: points[0].t,
            to: points[points.length - 1].t,
            bucketSeconds: 60,
            summary,
            points,
          } satisfies SeriesResponse;
        })
        .filter((x): x is SeriesResponse => !!x);
    }

    return (pastSeriesRaw ?? [])
      .map((s, i) => {
        const points = clipSeriesToHours(s.points, viewHours);
        if (!points.length) return null;
        const summary = summarizePoints(points);
        return {
          ...s,
          sensor: pastTargets[i]?.sensor ?? s.sensor,
          summary,
          points,
        } satisfies SeriesResponse;
      })
      .filter((x): x is SeriesResponse => !!x);
  }, [
    isToday,
    troughsHaveRun,
    targets,
    activeSimRuns,
    viewHours,
    type,
    pastSeriesRaw,
    pastTargets,
  ]);

  const companionByType = useMemo(() => {
    const out: Partial<
      Record<SensorType, { targets: SensorTarget[]; series: SeriesResponse[] }>
    > = {};
    if (!troughsHaveRun) return out;

    if (isToday) {
      for (const sensorType of companionTypes) {
        const typedTargets: SensorTarget[] = [];
        const series: SeriesResponse[] = [];
        for (const { trough, sim, sessionEndH } of activeSimRuns) {
          const sensor = trough.sensors.find((s) => s.type === sensorType);
          if (!sensor) continue;
          const points = simSeriesPoints(sim, sensorType, Math.min(viewHours, sessionEndH));
          if (!points.length) continue;
          typedTargets.push({ trough, sensor });
          series.push({
            sensor,
            from: points[0].t,
            to: points[points.length - 1].t,
            bucketSeconds: 60,
            summary: summarizePoints(points),
            points,
          });
        }
        if (typedTargets.length) out[sensorType] = { targets: typedTargets, series };
      }
      return out;
    }

    for (const sensorType of companionTypes) {
      const bundle = pastCompanions?.[sensorType];
      if (!bundle) continue;
      const paired = bundle.series
        .map((s, i) => {
          const points = clipSeriesToHours(s.points, viewHours);
          if (!points.length || !bundle.targets[i]) return null;
          return {
            target: bundle.targets[i],
            series: {
              ...s,
              sensor: bundle.targets[i].sensor,
              summary: summarizePoints(points),
              points,
            } satisfies SeriesResponse,
          };
        })
        .filter((x): x is { target: SensorTarget; series: SeriesResponse } => !!x);
      if (paired.length) {
        out[sensorType] = {
          targets: paired.map((p) => p.target),
          series: paired.map((p) => p.series),
        };
      }
    }
    return out;
  }, [
    troughsHaveRun,
    isToday,
    companionTypes,
    activeSimRuns,
    viewHours,
    pastCompanions,
  ]);

  const primaryTarget = targets.find((t) => t.trough.id === activeSimRuns[0]?.trough.id) ?? targets[0];

  const summary = useMemo(() => {
    if (!seriesList.length) return null;
    let min = Infinity;
    let max = -Infinity;
    let weighted = 0;
    let samples = 0;
    for (const s of seriesList) {
      if (!s.summary) continue;
      min = Math.min(min, s.summary.min);
      max = Math.max(max, s.summary.max);
      weighted += s.summary.avg * s.summary.samples;
      samples += s.summary.samples;
    }
    if (!samples) return null;
    return { min, max, avg: weighted / samples, samples };
  }, [seriesList]);

  const tableRows = useMemo(() => {
    if (!seriesList.length) return [];
    return buildReportRows(
      seriesList.map((s) => {
        const target = targets.find((t) => t.sensor.id === s.sensor.id);
        return {
          troughCode: target?.trough.code ?? s.sensor.troughId,
          minThreshold: target?.sensor.minThreshold ?? s.sensor.minThreshold,
          maxThreshold: target?.sensor.maxThreshold ?? s.sensor.maxThreshold,
          points: s.points,
        };
      }),
    );
  }, [seriesList, targets]);

  const periodAvg = summary?.avg ?? null;

  const mainYDomain = useMemo(
    () => yDomainForSensor(type, selectedSims),
    [type, selectedSims],
  );

  const sessionStartMs = useMemo(() => {
    if (!isToday || !selectedSims.length) return null;
    const starts = selectedSims
      .map((s) => Date.parse(s.sim.data.session.session_start))
      .filter(Number.isFinite);
    return starts.length ? Math.min(...starts) : null;
  }, [isToday, selectedSims]);

  /** Always pass selected troughs so axes/legend render before a run starts. */
  const mainHourSeries = useMemo((): HourSeries[] => {
    if (seriesList.length) {
      return seriesList.map((c, i) => {
        const trough = targets.find((t) => t.sensor.id === c.sensor.id)?.trough;
        const colorIdx = troughs?.findIndex((t) => t.id === trough?.id) ?? i;
        return {
          key: trough?.code ?? String(i),
          name: trough?.code ?? String(i),
          color: COMPARE_COLORS[colorIdx % COMPARE_COLORS.length],
          points: c.points,
        };
      });
    }
    return targets.map((t) => {
      const colorIdx = troughs?.findIndex((x) => x.id === t.trough.id) ?? 0;
      return {
        key: t.trough.code,
        name: t.trough.code,
        color: COMPARE_COLORS[colorIdx % COMPARE_COLORS.length],
        points: [] as SeriesPoint[],
      };
    });
  }, [seriesList, targets, troughs]);

  const toggleTrough = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const exportCsv = () => {
    if (!tableRows.length) return;
    const header = 'timestamp,trough,avg,min,max,span,pct_of_avg,status,unit\n';
    const rows = tableRows
      .map((r) => {
        const span = r.max - r.min;
        const pct = periodAvg != null && periodAvg !== 0 ? ((r.avg / periodAvg) * 100).toFixed(1) : '';
        const state =
          r.minThreshold != null && r.avg < r.minThreshold
            ? 'below_min'
            : r.maxThreshold != null && r.avg > r.maxThreshold
              ? 'above_max'
              : r.minThreshold != null || r.maxThreshold != null
                ? 'in_range'
                : '';
        return `${r.time},${r.troughCode},${r.avg},${r.min},${r.max},${span},${pct},${state},${meta.unit}`;
      })
      .join('\n');
    const codes = selectedTroughs.map((t) => t.code).join('_') || 'troughs';
    const url = URL.createObjectURL(new Blob([header + rows], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `twcs_report_${codes}_${type.toLowerCase()}_${viewHours}h.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!tableRows.length || exporting) return;
    setExporting(true);
    try {
      const codes = selectedTroughs.map((t) => t.code);
      const title = isCompare ? 'TWCS comparison report' : 'TWCS sensor report';
      const troughLabel = codes.join(', ');
      const companionCharts = troughsHaveRun
        ? companionTypes
            .map((sensorType) => {
              const el = companionRefs.current[sensorType];
              const bundle = companionByType[sensorType];
              if (!el || !bundle?.series.some((s) => s.points.length)) return null;
              return { title: SENSOR_META[sensorType].label, element: el };
            })
            .filter((x): x is { title: string; element: HTMLElement } => !!x)
        : [];

      await exportReportPdf({
        title,
        subtitle: `${meta.label} · full session · ${isCompare ? 'Multi-trough comparison' : troughLabel}`,
        meta: [
          `Troughs: ${troughLabel || '—'}`,
          `Generated: ${fmtDateTime(new Date())}`,
          `Session: ${viewHours} h · Samples: ${summary ? summary.samples.toLocaleString() : '—'}`,
          selectedSims.map((s) => `${s.trough.code} session ends ${s.sessionEndH}h`).join(' · '),
        ],
        stats: [
          { label: 'Minimum', value: `${fmtNumber(summary?.min, meta.decimals)} ${meta.unit}` },
          { label: 'Average', value: `${fmtNumber(summary?.avg, meta.decimals)} ${meta.unit}` },
          { label: 'Maximum', value: `${fmtNumber(summary?.max, meta.decimals)} ${meta.unit}` },
          { label: 'Samples', value: summary ? summary.samples.toLocaleString() : '—' },
        ],
        chartElement: chartRef.current,
        companionCharts,
        tableTitle: 'Detailed readings',
        tableHead: ['Time', 'Trough', `Avg (${meta.unit})`, 'Min', 'Max', 'Span', '% of avg', 'Status'],
        tableBody: tableRows.slice(0, 500).map((r) => {
          const span = r.max - r.min;
          const pct =
            periodAvg != null && periodAvg !== 0 ? `${fmtNumber((r.avg / periodAvg) * 100, 1)}%` : '—';
          const status =
            r.minThreshold != null && r.avg < r.minThreshold
              ? 'Below min'
              : r.maxThreshold != null && r.avg > r.maxThreshold
                ? 'Above max'
                : r.minThreshold != null || r.maxThreshold != null
                  ? 'In range'
                  : '—';
          return [
            fmtDateTime(r.time),
            r.troughCode,
            fmtNumber(r.avg, meta.decimals),
            fmtNumber(r.min, meta.decimals),
            fmtNumber(r.max, meta.decimals),
            fmtNumber(span, meta.decimals),
            pct,
            status,
          ];
        }),
        filename: `twcs_report_${codes.join('_') || 'troughs'}_${type.toLowerCase()}_${viewHours}h.pdf`,
      });
    } finally {
      setExporting(false);
    }
  };

  const chartTitle = isCompare
    ? `Comparison · ${meta.label}`
    : `${primaryTarget?.trough.code ?? selectedTroughs[0]?.code ?? ''} · ${meta.label}`;
  const chartSubtitle = troughsHaveRun
    ? `${dayRange.label} · one line per selected trough that has run`
    : isToday
      ? `${meta.label} over elapsed hours · waiting for session data`
      : `No trough runs on ${dayRange.label} for the selected troughs`;

  const dayLoading = !isToday && (dayBatchesLoading || (troughsHaveRun && pastSeriesLoading));

  return (
    <>
      <PageHeader
        title="Reports & analysis"
        description="Pick a day on the calendar, then review that day’s trough session charts"
        actions={<DayCalendar value={reportRange} onApply={setReportRange} />}
      />

      <div className="glass rounded-xl">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
          <span className="text-[11px] font-medium text-[#111827]/45">Troughs</span>
          <div className="flex flex-wrap items-center gap-1">
            {(troughs ?? []).map((t, i) => {
              const on = selectedIds.includes(t.id);
              const color = COMPARE_COLORS[i % COMPARE_COLORS.length];
              const hasSensor = t.sensors.some((s) => s.type === type);
              const simId = troughCodeToSimId(t.code);
              const sim = simId ? simState.troughs[simId] : undefined;
              const running = !!sim && isSimActive(sim);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!hasSensor}
                  onClick={() => toggleTrough(t.id)}
                  title={
                    hasSensor
                      ? `${t.name}${running ? ' · running' : ''}`
                      : `No ${meta.label} sensor`
                  }
                  className={clsx(
                    'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium tabular-nums transition',
                    on
                      ? 'bg-[#111827]/[0.06] text-[#111827]'
                      : 'text-[#111827]/40 hover:bg-[#111827]/[0.04] hover:text-[#111827]/70',
                    !hasSensor && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: on ? color : '#cbd5e1' }}
                  />
                  {t.code}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2 text-[11px]">
            <span className="text-[#111827]/40">
              {dayRange.label} · {selectedIds.length} selected{isCompare ? ' · comparison' : ''}
              {troughsHaveRun
                ? isToday
                  ? ` · ${activeSimRuns.length} running`
                  : ` · ${pastRunTroughIds.size} with runs`
                : ' · no runs'}
            </span>
            <button
              type="button"
              onClick={() =>
                setSelectedIds(
                  (troughs ?? []).filter((t) => t.sensors.some((s) => s.type === type)).map((t) => t.id),
                )
              }
              className="font-medium text-tea-700 hover:text-tea-600"
            >
              All
            </button>
            <span className="text-[#111827]/20">|</span>
            <button
              type="button"
              onClick={() => {
                const first = (troughs ?? []).find((t) => t.sensors.some((s) => s.type === type));
                if (first) setSelectedIds([first.id]);
              }}
              className="text-[#111827]/45 hover:text-[#111827]"
            >
              One
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Minimum" value={fmtNumber(summary?.min, meta.decimals)} unit={meta.unit} />
        <Stat label="Average" value={fmtNumber(summary?.avg, meta.decimals)} unit={meta.unit} />
        <Stat label="Maximum" value={fmtNumber(summary?.max, meta.decimals)} unit={meta.unit} />
        <Stat label="Samples" value={summary ? summary.samples.toLocaleString() : '—'} />
      </div>

      <Card
        className="mt-3"
        title={chartTitle}
        subtitle={chartSubtitle}
        action={
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!tableRows.length}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button size="sm" variant="primary" onClick={exportPdf} disabled={!tableRows.length || exporting}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              PDF
            </Button>
          </div>
        }
      >
        {!targets.length ? (
          <EmptyState title="Select at least one trough with this sensor" />
        ) : dayLoading ? (
          <Loading />
        ) : (
          <div ref={chartRef} className="rounded-lg bg-white/80 p-1">
            <SessionHoursChart
              series={mainHourSeries}
              xMaxHours={viewHours}
              yDomain={mainYDomain}
              unit={meta.unit}
              decimals={meta.decimals}
              height={MAIN_CHART_H}
              sessionStartMs={sessionStartMs}
              showLegend={mainHourSeries.length > 1}
            />
          </div>
        )}
      </Card>

      {selectedIds.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 px-0.5">
            <h2 className="text-sm font-semibold text-[#111827]">Related sensors</h2>
            <p className="mt-0.5 text-xs text-[#111827]/55">
              Same session · half size · included in PDF when data exists
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {companionTypes.map((sensorType) => {
              const m = SENSOR_META[sensorType];
              const bundle = companionByType[sensorType];
              const stubTargets =
                bundle?.targets.length
                  ? bundle.targets
                  : selectedTroughs
                      .map((t) => ({
                        trough: t,
                        sensor: t.sensors.find((s) => s.type === sensorType),
                      }))
                      .filter((x): x is SensorTarget => !!x.sensor);
              const hourSeries: HourSeries[] = stubTargets.map((t, i) => {
                const colorIdx = troughs?.findIndex((x) => x.id === t.trough.id) ?? i;
                const live = bundle?.series.find((s) => s.sensor.id === t.sensor.id);
                return {
                  key: t.trough.code,
                  name: t.trough.code,
                  color: COMPARE_COLORS[colorIdx % COMPARE_COLORS.length],
                  points: live?.points ?? [],
                };
              });

              return (
                <Card
                  key={sensorType}
                  title={m.label}
                  subtitle={
                    troughsHaveRun
                      ? m.unit
                      : `${m.unit} · waiting for session data`
                  }
                >
                  <div
                    ref={(el) => {
                      companionRefs.current[sensorType] = el;
                    }}
                    className="rounded-lg bg-white/80 p-1"
                  >
                    <SessionHoursChart
                      series={hourSeries}
                      xMaxHours={viewHours}
                      yDomain={yDomainForSensor(sensorType, selectedSims)}
                      unit={m.unit}
                      decimals={m.decimals}
                      height={HALF_CHART_H}
                      sessionStartMs={sessionStartMs}
                      showLegend={hourSeries.length > 1}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {isCompare && seriesList.length > 0 && (
        <Card className="mt-3" title="Per-trough summary" subtitle={meta.label}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Trough</th>
                  <th className="text-right">Session end</th>
                  <th className="text-right">Min</th>
                  <th className="text-right">Avg</th>
                  <th className="text-right">Max</th>
                  <th className="text-right">Samples</th>
                </tr>
              </thead>
              <tbody>
                {seriesList.map((s) => {
                  const trough = targets.find((t) => t.sensor.id === s.sensor.id)?.trough;
                  const bind = selectedSims.find((b) => b.trough.id === trough?.id);
                  return (
                    <tr key={trough?.id ?? s.sensor.id}>
                      <td className="font-medium tabular-nums text-[#111827]">{trough?.code ?? '—'}</td>
                      <td className="text-right tabular-nums text-[#111827]/60">
                        {bind ? `${bind.sessionEndH} h` : '—'}
                      </td>
                      <td className="text-right tabular-nums">{fmtNumber(s.summary?.min, meta.decimals)}</td>
                      <td className="text-right tabular-nums">{fmtNumber(s.summary?.avg, meta.decimals)}</td>
                      <td className="text-right tabular-nums">{fmtNumber(s.summary?.max, meta.decimals)}</td>
                      <td className="text-right tabular-nums">{s.summary?.samples.toLocaleString() ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ReportDataTable rows={tableRows} meta={meta} periodAvg={periodAvg} />
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <p className="text-xs uppercase tracking-wide text-[#111827]/45">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[#111827]">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-[#111827]/45">{unit}</span>}
      </p>
    </div>
  );
}
