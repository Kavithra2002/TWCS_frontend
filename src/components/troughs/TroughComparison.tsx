'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Clock3,
  Maximize2,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { getPhase, type SimTroughState } from '@/contexts/SimulatorContext';
import { fmtDuration, fmtNumber } from '@/lib/format';
import type { SimPoint, SimTroughData } from '@/lib/sim-data';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';

// ── Constants ──────────────────────────────────────────────────────────────────

const COMPARE_COLORS = [
  '#22c55e',
  '#38bdf8',
  '#f97316',
  '#a78bfa',
  '#facc15',
  '#fb7185',
];

type MetricKey = 'ws' | 'weight' | 'temp' | 'humidity' | 'fan' | 'energy';

const METRIC_OPTIONS: {
  value: MetricKey;
  label: string;
  unit: string;
  subtitle: string;
}[] = [
  {
    value: 'ws',
    label: 'Wither %',
    unit: '% WS',
    subtitle: 'Wither standard over elapsed hours for each trough',
  },
  {
    value: 'weight',
    label: 'Weight',
    unit: 'kg',
    subtitle: 'Leaf weight decline across the withering session',
  },
  {
    value: 'temp',
    label: 'Temp',
    unit: '°C',
    subtitle: 'Inlet / ambient temperature overlay by trough',
  },
  {
    value: 'humidity',
    label: 'Humidity',
    unit: '%RH',
    subtitle: 'Relative humidity overlay by trough',
  },
  {
    value: 'fan',
    label: 'Fan',
    unit: 'Hz',
    subtitle: 'Fan speed demand over the session',
  },
  {
    value: 'energy',
    label: 'Energy',
    unit: 'kWh',
    subtitle: 'Cumulative energy use across troughs',
  },
];

const CHART_POINTS = 120;
const CARD_CHART_H = 240;
const MAX_CHART_H = 440;

const tooltipStyle = {
  background: 'var(--chart-tooltip-bg)',
  color: 'var(--chart-tooltip-fg)',
  border: '1px solid var(--chart-tooltip-border)',
  borderRadius: 8,
  fontSize: 12,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function troughLabel(data: SimTroughData): string {
  return `Trough ${data.session.trough_number}`;
}

function pickMetric(point: SimPoint, metric: MetricKey, startWeight: number): number | null {
  switch (metric) {
    case 'ws':
      return point.current_ws_pct;
    case 'weight':
      return (
        point.weight_kg ??
        (point.current_ws_pct != null ? (startWeight * point.current_ws_pct) / 100 : null)
      );
    case 'temp':
      return point.inlet_temp_c ?? point.ambient_temp_c ?? point.upper_temp_c;
    case 'humidity':
      return point.inlet_rh_pct ?? point.ambient_rh_pct ?? point.upper_rh_pct;
    case 'fan':
      return point.fan_speed_hz;
    case 'energy':
      return point.cumulative_energy_kwh;
    default:
      return null;
  }
}

/**
 * Progressive sample like Live Monitoring:
 * - recent points are kept 1:1 so each simulator tick extends the tip
 * - older history uses a fixed stride from the full series (stable, no reshuffle)
 */
function progressiveSample<T>(progressed: T[], fullLength: number, max: number): T[] {
  if (progressed.length === 0) return [];
  if (progressed.length <= max) return progressed;

  const stride = Math.max(1, Math.ceil(fullLength / max));
  const recentCount = Math.min(80, progressed.length);
  const recentStart = progressed.length - recentCount;

  const out: T[] = [];
  for (let i = 0; i < recentStart; i += stride) out.push(progressed[i]);
  for (let i = recentStart; i < progressed.length; i++) out.push(progressed[i]);
  return out;
}

interface TroughRunSummary {
  id: string;
  label: string;
  color: string;
  finalWs: number;
  deltaTarget: number;
  durationMin: number;
  energyKwh: number | null;
  isDone: boolean;
}

function hasProgress(t: SimTroughState): boolean {
  return t.running || t.idx > 0;
}

function progressedSeries(t: SimTroughState): SimPoint[] {
  if (!hasProgress(t)) return [];
  return t.data.timeSeries.slice(0, t.idx + 1);
}

function buildSummary(t: SimTroughState, color: string): TroughRunSummary {
  const { data, idx, running } = t;
  const { session, events, timeSeries } = data;
  const currentPoint = timeSeries[idx] ?? timeSeries[0];
  const startMs = Date.parse(session.session_start);
  const atMs = Date.parse(currentPoint?.timestamp ?? session.session_start);
  const durationMin = Math.max(0, Math.round((atMs - startMs) / 60_000));
  const finalWs = currentPoint?.current_ws_pct ?? 100;
  const phase = getPhase(session, events, currentPoint?.timestamp ?? session.session_start);
  const started = hasProgress(t);

  return {
    id: data.id,
    label: troughLabel(data),
    color,
    finalWs,
    deltaTarget: finalWs - session.target_ws_pct,
    durationMin,
    energyKwh: currentPoint?.cumulative_energy_kwh ?? null,
    isDone: started && phase === 'DONE' && !running,
  };
}

function buildTrendRows(
  selected: SimTroughState[],
  metric: MetricKey,
): { rows: Record<string, number>[]; tipHourById: Record<string, number> } {
  const tipHourById: Record<string, number> = {};
  const map = new Map<number, Record<string, number>>();

  for (const t of selected) {
    const startMs = Date.parse(t.data.session.session_start);
    const startWeight = t.data.session.starting_weight_kg;
    const progressed = progressedSeries(t);
    const samples = progressiveSample(progressed, t.data.timeSeries.length, CHART_POINTS);

    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      const value = pickMetric(p, metric, startWeight);
      if (value == null) continue;
      // Fine hour key so each simulator tick can advance the tip (≈ point-by-point).
      const h = Math.round(((Date.parse(p.timestamp) - startMs) / 3_600_000) * 1000) / 1000;
      const row = map.get(h) ?? { h };
      row[t.data.id] = value;
      map.set(h, row);
      if (i === samples.length - 1) tipHourById[t.data.id] = h;
    }
  }

  return {
    rows: [...map.values()].sort((a, b) => a.h - b.h),
    tipHourById,
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InsightStat({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5 sm:px-4">
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" style={{ color: accent }} strokeWidth={1.75} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[10px] font-medium tracking-wide text-[#111827]/45">{label}</p>
        <p className="truncate text-[13px] font-semibold text-[#111827]">
          {value}
          {hint && (
            <span className="ml-1.5 font-normal text-[#111827]/50">{hint}</span>
          )}
        </p>
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  onMaximize,
  children,
}: {
  title: string;
  subtitle: string;
  onMaximize: () => void;
  children: ReactNode;
}) {
  return (
    <Card
      title={title}
      subtitle={subtitle}
      action={
        <button
          type="button"
          onClick={onMaximize}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#111827]/45 transition hover:bg-[#111827]/[0.05] hover:text-[#111827]"
          aria-label={`Maximize ${title}`}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Expand
        </button>
      }
    >
      {children}
    </Card>
  );
}

/** Empty grid scaffold so axes render before any session points exist. */
function emptyAxisRows(maxHours: number): Record<string, number>[] {
  const end = Math.max(1, Math.ceil(maxHours));
  const rows: Record<string, number>[] = [];
  for (let h = 0; h <= end; h += 1) rows.push({ h });
  return rows;
}

function MetricOverlayChart({
  rows,
  tipHourById,
  summaries,
  legendItems,
  unit,
  height,
  xMaxHours,
  yDomain,
  showLegend = true,
}: {
  rows: Record<string, number>[];
  tipHourById: Record<string, number>;
  summaries: TroughRunSummary[];
  /** Legend stubs (selected troughs) even when no data lines yet. */
  legendItems: { id: string; label: string; color: string }[];
  unit: string;
  height: number;
  xMaxHours: number;
  yDomain: [number, number];
  showLegend?: boolean;
}) {
  const hasLines = summaries.length > 0 && rows.length > 0;
  const chartRows = hasLines ? rows : emptyAxisRows(xMaxHours);
  const xMax = Math.max(xMaxHours, 1);
  const xStep = Math.max(1, Math.round(xMax / 7));
  const xTicks = Array.from({ length: Math.floor(xMax) + 1 }, (_, i) => i).filter(
    (h) => h % xStep === 0 || h === Math.floor(xMax),
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartRows} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="h"
          type="number"
          domain={[0, xMax]}
          ticks={xTicks}
          tickFormatter={(v) => `${Number(v).toFixed(0)}h`}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          domain={yDomain}
          allowDataOverflow
          label={{
            value: unit,
            angle: -90,
            position: 'insideLeft',
            offset: 14,
            fill: '#71717a',
            fontSize: 10,
          }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(v) => `${Number(v).toFixed(2)} h elapsed`}
          formatter={(v: number, name: string) => {
            const s = summaries.find((x) => x.id === name) ?? legendItems.find((x) => x.id === name);
            return [fmtNumber(v, 1), s?.label ?? name];
          }}
        />
        {showLegend && legendItems.length > 0 && (
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            payload={legendItems.map((item) => ({
              value: item.id,
              type: 'line' as const,
              color: item.color,
              id: item.id,
            }))}
            formatter={(value) =>
              legendItems.find((s) => s.id === value)?.label.replace('Trough ', 'T') ?? value
            }
          />
        )}
        {summaries.map((s) => {
          const tipH = tipHourById[s.id];
          return (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.id}
              stroke={s.color}
              strokeWidth={2}
              connectNulls
              isAnimationActive={false}
              dot={(props) => {
                const { cx, cy, payload, value, index } = props;
                const pointKey = `${s.id}-${payload?.h ?? index ?? 'x'}`;
                if (
                  value == null ||
                  cx == null ||
                  cy == null ||
                  tipH == null ||
                  payload?.h !== tipH
                ) {
                  return <g key={pointKey} />;
                }
                return (
                  <circle
                    key={pointKey}
                    cx={cx}
                    cy={cy}
                    r={3.5}
                    fill={s.color}
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={1.5}
                  />
                );
              }}
              activeDot={{ r: 4, strokeWidth: 1.5 }}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

interface Props {
  troughs: SimTroughState[];
}

export function TroughComparison({ troughs }: Props) {
  const sorted = useMemo(
    () => [...troughs].sort((a, b) => a.data.session.trough_number - b.data.session.trough_number),
    [troughs],
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [maxMetric, setMaxMetric] = useState<MetricKey | null>(null);

  useEffect(() => {
    if (!initialized && sorted.length) {
      setSelectedIds(sorted.map((t) => t.data.id));
      setInitialized(true);
    }
  }, [sorted, initialized]);

  const colorById = useMemo(() => {
    const map: Record<string, string> = {};
    sorted.forEach((t, i) => {
      map[t.data.id] = COMPARE_COLORS[i % COMPARE_COLORS.length];
    });
    return map;
  }, [sorted]);

  const selected = useMemo(
    () => sorted.filter((t) => selectedIds.includes(t.data.id)),
    [sorted, selectedIds],
  );

  /** Only troughs that have started a session contribute to charts / insights. */
  const activeSelected = useMemo(() => selected.filter(hasProgress), [selected]);

  const summaries = useMemo(
    () => activeSelected.map((t) => buildSummary(t, colorById[t.data.id])),
    [activeSelected, colorById],
  );

  const hasAnyProgress = activeSelected.length > 0;

  const legendItems = useMemo(
    () =>
      selected.map((t) => ({
        id: t.data.id,
        label: troughLabel(t.data),
        color: colorById[t.data.id],
      })),
    [selected, colorById],
  );

  const xMaxHours = useMemo(() => {
    const source = selected.length ? selected : sorted;
    let maxH = 14;
    for (const t of source) {
      const start = Date.parse(t.data.session.session_start);
      const end = Date.parse(t.data.session.session_end);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        maxH = Math.max(maxH, (end - start) / 3_600_000);
      }
    }
    return Math.ceil(maxH);
  }, [selected, sorted]);

  /** Lock Y domains to the full session range so axes stay still while points append. */
  const yDomainByMetric = useMemo((): Record<MetricKey, [number, number]> => {
    const fallback: Record<MetricKey, [number, number]> = {
      ws: [50, 100],
      weight: [0, 2000],
      temp: [20, 40],
      humidity: [40, 90],
      fan: [0, 60],
      energy: [0, 10],
    };
    const source = selected.length ? selected : sorted;
    if (!source.length) return fallback;

    const mins: Record<MetricKey, number> = {
      ws: Infinity, weight: Infinity, temp: Infinity,
      humidity: Infinity, fan: Infinity, energy: Infinity,
    };
    const maxs: Record<MetricKey, number> = {
      ws: -Infinity, weight: -Infinity, temp: -Infinity,
      humidity: -Infinity, fan: -Infinity, energy: -Infinity,
    };

    for (const t of source) {
      const startWeight = t.data.session.starting_weight_kg;
      // Sample the full series sparsely — domain must not depend on live idx.
      const full = progressiveSample(t.data.timeSeries, t.data.timeSeries.length, CHART_POINTS);
      for (const p of full) {
        for (const m of METRIC_OPTIONS) {
          const v = pickMetric(p, m.value, startWeight);
          if (v == null || !Number.isFinite(v)) continue;
          mins[m.value] = Math.min(mins[m.value], v);
          maxs[m.value] = Math.max(maxs[m.value], v);
        }
      }
    }

    const out = { ...fallback };
    for (const m of METRIC_OPTIONS) {
      if (!Number.isFinite(mins[m.value]) || !Number.isFinite(maxs[m.value])) continue;
      const pad = Math.max((maxs[m.value] - mins[m.value]) * 0.06, m.value === 'ws' ? 1 : 0.5);
      out[m.value] = [
        Math.floor((mins[m.value] - pad) * 10) / 10,
        Math.ceil((maxs[m.value] + pad) * 10) / 10,
      ];
    }
    return out;
  }, [selected, sorted]);

  // Rebuild when any selected trough's idx advances (point-by-point live draw).
  const progressKey = activeSelected.map((t) => `${t.data.id}:${t.idx}`).join('|');

  const trendByMetric = useMemo(() => {
    const out = {} as Record<
      MetricKey,
      { rows: Record<string, number>[]; tipHourById: Record<string, number> }
    >;
    for (const m of METRIC_OPTIONS) {
      out[m.value] = buildTrendRows(activeSelected, m.value);
    }
    return out;
    // progressKey tracks idx ticks; activeSelected alone can miss updates if refs are reused
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSelected, progressKey]);

  const insights = useMemo(() => {
    if (!summaries.length) return null;
    const bestWs = [...summaries].sort((a, b) => a.finalWs - b.finalWs)[0];
    const fastest = [...summaries].sort((a, b) => a.durationMin - b.durationMin)[0];
    const leanest = [...summaries]
      .filter((s) => s.energyKwh != null)
      .sort((a, b) => (a.energyKwh ?? 0) - (b.energyKwh ?? 0))[0];
    const closest = [...summaries].sort(
      (a, b) => Math.abs(a.deltaTarget) - Math.abs(b.deltaTarget),
    )[0];
    return { bestWs, fastest, leanest, closest };
  }, [summaries]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const doneCount = summaries.filter((s) => s.isDone).length;
  const maxMeta = maxMetric ? METRIC_OPTIONS.find((m) => m.value === maxMetric) : null;

  return (
    <section className="mt-5 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[#111827]">
            Trough comparison
          </h2>
          <p className="mt-0.5 text-xs text-[#111827]/55">
            Session overlays · wither, weight, climate, fan, energy
            {doneCount > 0 ? ` · ${doneCount} finished` : ''}
          </p>
        </div>
      </div>

      {/* Compact picker + insights in one panel */}
      <div className="glass rounded-xl">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-black/[0.06] px-3 py-2">
          <span className="text-[11px] font-medium text-[#111827]/45">Troughs</span>
          <div className="flex flex-wrap items-center gap-1">
            {sorted.map((t) => {
              const id = t.data.id;
              const on = selectedIds.includes(id);
              const color = colorById[id];
              const n = t.data.session.trough_number;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  title={troughLabel(t.data)}
                  className={clsx(
                    'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium tabular-nums transition',
                    on
                      ? 'bg-[#111827]/[0.06] text-[#111827]'
                      : 'text-[#111827]/40 hover:bg-[#111827]/[0.04] hover:text-[#111827]/70',
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: on ? color : '#cbd5e1' }}
                  />
                  T{n}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedIds(sorted.map((t) => t.data.id))}
              className="font-medium text-tea-700 hover:text-tea-600"
            >
              All
            </button>
            <span className="text-[#111827]/20">|</span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-[#111827]/45 hover:text-[#111827]"
            >
              None
            </button>
          </div>
        </div>

        {insights && hasAnyProgress && (
          <div className="grid grid-cols-2 divide-x divide-y divide-black/[0.06] xl:grid-cols-4 xl:divide-y-0">
            <InsightStat
              icon={Trophy}
              label="Best wither"
              value={insights.bestWs.label.replace('Trough ', 'T')}
              hint={`${fmtNumber(insights.bestWs.finalWs, 1)}% WS`}
              accent={insights.bestWs.color}
            />
            <InsightStat
              icon={Target}
              label="Closest to target"
              value={insights.closest.label.replace('Trough ', 'T')}
              hint={`Δ ${fmtNumber(insights.closest.deltaTarget, 1)}`}
              accent={insights.closest.color}
            />
            <InsightStat
              icon={Clock3}
              label="Shortest run"
              value={insights.fastest.label.replace('Trough ', 'T')}
              hint={fmtDuration(insights.fastest.durationMin)}
              accent={insights.fastest.color}
            />
            <InsightStat
              icon={Zap}
              label="Lowest energy"
              value={(insights.leanest?.label ?? '—').replace('Trough ', 'T')}
              hint={
                insights.leanest?.energyKwh != null
                  ? `${fmtNumber(insights.leanest.energyKwh, 1)} kWh`
                  : undefined
              }
              accent={insights.leanest?.color ?? '#64748b'}
            />
          </div>
        )}
      </div>

      {!selected.length ? (
        <Card>
          <p className="py-8 text-center text-sm text-[#111827]/55">
            Select at least one trough to compare.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {METRIC_OPTIONS.map((m) => (
            <ChartPanel
              key={m.value}
              title={m.label}
              subtitle={
                hasAnyProgress
                  ? m.subtitle
                  : `${m.subtitle} · waiting for session data`
              }
              onMaximize={() => setMaxMetric(m.value)}
            >
              <MetricOverlayChart
                rows={trendByMetric[m.value].rows}
                tipHourById={trendByMetric[m.value].tipHourById}
                summaries={summaries}
                legendItems={legendItems}
                unit={m.unit}
                height={CARD_CHART_H}
                xMaxHours={xMaxHours}
                yDomain={yDomainByMetric[m.value]}
              />
            </ChartPanel>
          ))}
        </div>
      )}

      <Modal
        open={maxMetric != null}
        title={maxMeta?.label ?? ''}
        description={maxMeta?.subtitle}
        onClose={() => setMaxMetric(null)}
        panelClassName="max-w-5xl !border-black/10 !bg-white shadow-2xl [&_#modal-title]:!text-[#111827] [&>header_p]:!text-[#111827]/65 [&>header_button]:!text-[#111827]/55 [&>header_button:hover]:!bg-black/5 [&>header_button:hover]:!text-[#111827]"
      >
        {maxMetric && maxMeta && (
          <MetricOverlayChart
            rows={trendByMetric[maxMetric].rows}
            tipHourById={trendByMetric[maxMetric].tipHourById}
            summaries={summaries}
            legendItems={legendItems}
            unit={maxMeta.unit}
            height={MAX_CHART_H}
            xMaxHours={xMaxHours}
            yDomain={yDomainByMetric[maxMetric]}
          />
        )}
      </Modal>
    </section>
  );
}
