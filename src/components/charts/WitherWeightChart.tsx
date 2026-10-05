'use client';

import clsx from 'clsx';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { fmtNumber } from '@/lib/format';
import type { WitherSnapshotPoint } from '@/lib/moc-run';

const WEIGHT_COLOR = '#2e9862';

const OVERLAYS = [
  { key: 'vfdHz', label: 'VFD frequency', unit: 'Hz', color: '#38bdf8', decimals: 1 },
  { key: 'hotLouverPct', label: 'Hot louver', unit: '%', color: '#f97316', decimals: 0 },
  { key: 'coldLouverPct', label: 'Cold louver', unit: '%', color: '#22d3ee', decimals: 0 },
] as const;

type OverlayKey = (typeof OVERLAYS)[number]['key'];

interface Row {
  hour: number;
  file: string;
  weightKg: number;
  vfdHz: number | null;
  hotLouverPct: number | null;
  coldLouverPct: number | null;
  /** Selected control, scaled onto the weight range so it shares the left axis. */
  overlay: number | null;
}

function latestValue(points: WitherSnapshotPoint[], key: OverlayKey): number | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const value = points[i][key];
    if (value != null) return value;
  }
  return null;
}

function fmtHour(hour: number): string {
  const rounded = Math.round(hour * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, '');
}

/** Map a control series onto the weight min–max so both lines share one axis. */
function scaleOntoWeight(value: number, sourceMin: number, sourceMax: number, weightMin: number, weightMax: number): number {
  const span = sourceMax - sourceMin;
  const t = span < 1e-6 ? 0.5 : (value - sourceMin) / span;
  return weightMin + t * (weightMax - weightMin);
}

export function WitherWeightChart({ points }: { points: WitherSnapshotPoint[] }) {
  const [selectedKey, setSelectedKey] = useState<OverlayKey | null>(null);
  const selected = OVERLAYS.find((item) => item.key === selectedKey) ?? null;

  const duration = points.length > 0 ? points[points.length - 1].hour : 14;
  const surfaceEnd = Math.round(duration * 0.3 * 10) / 10;

  const data: Row[] = useMemo(() => {
    const weights = points.map((point) => point.weightKg);
    const weightMin = weights.length > 0 ? Math.min(...weights) : 0;
    const weightMax = weights.length > 0 ? Math.max(...weights) : 1;
    const raw = selected ? points.map((point) => point[selected.key]).filter((value): value is number => value != null) : [];
    const sourceMin = raw.length > 0 ? Math.min(...raw) : 0;
    const sourceMax = raw.length > 0 ? Math.max(...raw) : 1;

    return points.map((point) => {
      const value = selected ? point[selected.key] : null;
      return {
        hour: point.hour,
        file: point.file,
        weightKg: point.weightKg,
        vfdHz: point.vfdHz,
        hotLouverPct: point.hotLouverPct,
        coldLouverPct: point.coldLouverPct,
        overlay: value == null || !selected ? null : scaleOntoWeight(value, sourceMin, sourceMax, weightMin, weightMax),
      };
    });
  }, [points, selected]);

  const start = points[0];
  const end = points[points.length - 1];
  const surfacePoint = points.reduce<WitherSnapshotPoint | undefined>((nearest, point) => {
    if (!nearest) return point;
    return Math.abs(point.hour - surfaceEnd) < Math.abs(nearest.hour - surfaceEnd) ? point : nearest;
  }, undefined);

  const select = (key: OverlayKey) => setSelectedKey((current) => (current === key ? null : key));

  const tooltip = ({ active: open, payload }: TooltipProps<number, string>) => {
    if (!open || !payload?.length) return null;
    const row = payload[0].payload as Row;
    const overlayValue = selected ? row[selected.key] : null;
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-lg">
        <p className="mb-1 text-slate-400">
          {fmtHour(row.hour)} h · {row.file}
        </p>
        <p className="font-medium" style={{ color: WEIGHT_COLOR }}>
          Weight {fmtNumber(row.weightKg, 1)} kg
        </p>
        {selected && overlayValue != null && (
          <p className="mt-0.5 font-medium" style={{ color: selected.color }}>
            {selected.label} {fmtNumber(overlayValue, selected.decimals)} {selected.unit}
          </p>
        )}
      </div>
    );
  };

  return (
    <Card
      title="Leaf weight"
      subtitle="Solid line is weight. Select one control to overlay its shape as a dotted line."
      action={
        <div className="flex flex-wrap justify-end gap-2">
          {OVERLAYS.map((item) => {
            const on = selectedKey === item.key;
            const value = latestValue(points, item.key);
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={on}
                onClick={() => select(item.key)}
                className={clsx(
                  'min-w-[9.5rem] rounded-lg border px-3 py-2 text-left transition',
                  on ? 'bg-slate-800/80' : 'border-slate-700 bg-slate-900 hover:bg-slate-800/60',
                )}
                style={on ? { borderColor: item.color, boxShadow: `inset 3px 0 0 ${item.color}` } : undefined}
              >
                <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">{item.label}</span>
                <span className="mt-0.5 block text-sm font-semibold tabular-nums text-slate-50">
                  {value == null ? '—' : fmtNumber(value, item.decimals)}
                  <span className="ml-1 text-xs font-normal text-slate-400">{item.unit}</span>
                </span>
              </button>
            );
          })}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>
          <span className="mr-1.5 inline-block h-0.5 w-4 align-middle" style={{ backgroundColor: WEIGHT_COLOR }} />
          Weight
          {start && end ? ` ${fmtNumber(start.weightKg, 0)} → ${fmtNumber(end.weightKg, 0)} kg` : ''}
        </span>
        <span>0–{fmtHour(surfaceEnd)} h surface moisture, fast loss{surfacePoint && start ? ` (${fmtNumber(start.weightKg - surfacePoint.weightKg, 0)} kg)` : ''}</span>
        <span>
          {fmtHour(surfaceEnd)}–{fmtHour(duration)} h internal moisture, gradual loss
          {surfacePoint && end ? ` (${fmtNumber(surfacePoint.weightKg - end.weightKg, 0)} kg)` : ''}
        </span>
        {selected && <span>Dotted line is normalized onto the weight scale.</span>}
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="hour"
            type="number"
            domain={[0, duration]}
            ticks={[0, 2, 4, 6, 8, 10, 12, 14].filter((tick) => tick <= duration + 0.01)}
            tickFormatter={(value: number) => `${value}h`}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            domain={['auto', 'auto']}
            tickFormatter={(value: number) => fmtNumber(value, 0)}
          />
          <Tooltip content={tooltip} />
          <ReferenceLine
            x={surfaceEnd}
            stroke="#71717a"
            strokeDasharray="3 3"
            label={{ value: '30%', position: 'insideTopLeft', fill: '#a1a1aa', fontSize: 10 }}
          />
          <Line dataKey="weightKg" name="Weight" stroke={WEIGHT_COLOR} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          {selected && (
            <Line
              dataKey="overlay"
              name={selected.label}
              stroke={selected.color}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
