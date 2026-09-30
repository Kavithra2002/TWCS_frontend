'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { fmtNumber, fmtShortDateTime, fmtTime } from '@/lib/format';
import type { SeriesPoint } from '@/types';

interface TimeSeriesChartProps {
  points: SeriesPoint[];
  color: string;
  unit: string;
  decimals?: number;
  minThreshold?: number | null;
  maxThreshold?: number | null;
  height?: number;
  /** Show the min–max envelope of each bucket behind the average line. */
  showBand?: boolean;
}

interface Row {
  ts: number;
  avg: number;
  band: [number, number];
}

export function TimeSeriesChart({
  points,
  color,
  unit,
  decimals = 1,
  minThreshold,
  maxThreshold,
  height = 220,
  showBand = true,
}: TimeSeriesChartProps) {
  const data: Row[] = points.map((p) => ({ ts: new Date(p.t).getTime(), avg: p.avg, band: [p.min, p.max] }));
  const spanMs = data.length > 1 ? data[data.length - 1].ts - data[0].ts : 0;
  const multiDay = spanMs > 36 * 60 * 60 * 1000;
  const gradientId = `band-${color.replace('#', '')}`;

  const tooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as Row;
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-lg">
        <p className="mb-1 text-slate-400">{fmtShortDateTime(row.ts)}</p>
        <p className="font-medium" style={{ color }}>
          Avg {fmtNumber(row.avg, decimals)} {unit}
        </p>
        {showBand && (
          <p className="text-slate-400">
            Range {fmtNumber(row.band[0], decimals)} – {fmtNumber(row.band[1], decimals)}
          </p>
        )}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="ts"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v) => (multiDay ? fmtShortDateTime(v).slice(0, 6) : fmtTime(v))}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          domain={['auto', 'auto']}
          tickFormatter={(v: number) => fmtNumber(v, decimals === 0 ? 0 : 1)}
        />
        <Tooltip content={tooltip} />
        {showBand && <Area dataKey="band" stroke="none" fill={`url(#${gradientId})`} isAnimationActive={false} />}
        <Line dataKey="avg" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        {minThreshold != null && (
          <ReferenceLine y={minThreshold} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `min ${minThreshold}`, position: 'insideBottomRight', fill: '#f59e0b', fontSize: 10 }} />
        )}
        {maxThreshold != null && (
          <ReferenceLine y={maxThreshold} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `max ${maxThreshold}`, position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
