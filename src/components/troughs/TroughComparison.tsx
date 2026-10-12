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

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [];
  const step = (arr.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(arr[Math.round(i * step)]);
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

function buildSummary(t: SimTroughState, color: string): TroughRunSummary {
  const { data, idx, running } = t;
  const { session, events, timeSeries } = data;
  const last = timeSeries[timeSeries.length - 1] ?? timeSeries[0];
  const startMs = Date.parse(session.session_start);
  const endMs = Date.parse(session.session_end);
  const durationMin = Math.max(0, Math.round((endMs - startMs) / 60_000));
  const finalWs = last?.current_ws_pct ?? 100;

  const currentPoint = timeSeries[idx] ?? timeSeries[0];
  const phase = getPhase(session, events, currentPoint?.timestamp ?? session.session_start);
  const started = running || idx > 0;

  return {
    id: data.id,
    label: troughLabel(data),
    color,
    finalWs,
    deltaTarget: finalWs - session.target_ws_pct,
    durationMin,
    energyKwh: last?.cumulative_energy_kwh ?? null,
    isDone: started && phase === 'DONE' && !running,
  };
}

function buildTrendRows(
  selected: SimTroughState[],
  metric: MetricKey,
): Record<string, number>[] {
  const series = selected.map((t) => {
    const startMs = Date.parse(t.data.session.session_start);
    const startWeight = t.data.session.starting_weight_kg;
    const points = downsample(t.data.timeSeries, CHART_POINTS)
      .map((p) => {
        const value = pickMetric(p, metric, startWeight);
        if (value == null) return null;
        return {
          h: Math.max(0, (Date.parse(p.timestamp) - startMs) / 3_600_000),
          v: value,
        };
      })
      .filter((x): x is { h: number; v: number } => x != null);
    return { id: t.data.id, points };
  });

  const bucket = 0.25;
  const map = new Map<number, Record<string, number>>();
  for (const s of series) {
    for (const p of s.points) {
      const key = Math.round(p.h / bucket) * bucket;
      const row = map.get(key) ?? { h: key };
      row[s.id] = p.v;
      map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => a.h - b.h);
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

function MetricOverlayChart({
  rows,
  summaries,
  unit,
  height,
  showLegend = true,
}: {
  rows: Record<string, number>[];
  summaries: TroughRunSummary[];
  unit: string;
  height: number;
  showLegend?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="h"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v) => `${Number(v).toFixed(0)}h`}
          tickLine={false}
          axisLine={false}
          minTickGap={36}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          domain={['auto', 'auto']}
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
          labelFormatter={(v) => `${Number(v).toFixed(1)} h elapsed`}
          formatter={(v: number, name: string) => {
            const s = summaries.find((x) => x.id === name);
            return [fmtNumber(v, 1), s?.label ?? name];
          }}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) =>
              summaries.find((s) => s.id === value)?.label.replace('Trough ', 'T') ?? value
            }
          />
        )}
        {summaries.map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.id}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        ))}
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

  const summaries = useMemo(
    () => selected.map((t) => buildSummary(t, colorById[t.data.id])),
    [selected, colorById],
  );

  // Precompute series for all 6 metrics so cards stay snappy
  const trendByMetric = useMemo(() => {
    const out = {} as Record<MetricKey, Record<string, number>[]>;
    for (const m of METRIC_OPTIONS) {
      out[m.value] = buildTrendRows(selected, m.value);
    }
    return out;
  }, [selected]);

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
    <section className="mt-8 space-y-3">
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

        {insights && summaries.length > 0 && (
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

      {!summaries.length ? (
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
              subtitle={m.subtitle}
              onMaximize={() => setMaxMetric(m.value)}
            >
              <MetricOverlayChart
                rows={trendByMetric[m.value]}
                summaries={summaries}
                unit={m.unit}
                height={CARD_CHART_H}
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
            rows={trendByMetric[maxMetric]}
            summaries={summaries}
            unit={maxMeta.unit}
            height={MAX_CHART_H}
          />
        )}
      </Modal>
    </section>
  );
}
