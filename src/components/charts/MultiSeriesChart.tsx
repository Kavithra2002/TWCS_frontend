'use client';

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
import { fmtNumber, fmtShortDateTime, fmtTime } from '@/lib/format';
import type { SeriesPoint } from '@/types';

export interface NamedSeries {
  key: string;
  name: string;
  color: string;
  points: SeriesPoint[];
  /** Plot on the right-hand axis */
  right?: boolean;
}

interface MultiSeriesChartProps {
  series: NamedSeries[];
  height?: number;
  decimals?: number;
  leftUnit?: string;
  rightUnit?: string;
}

/** Several averaged series on a shared time axis (e.g. trough comparison, temp vs humidity). */
export function MultiSeriesChart({ series, height = 260, decimals = 1, leftUnit, rightUnit }: MultiSeriesChartProps) {
  const rows = new Map<number, Record<string, number>>();
  for (const s of series) {
    for (const p of s.points) {
      const ts = new Date(p.t).getTime();
      const row = rows.get(ts) ?? { ts };
      row[s.key] = p.avg;
      rows.set(ts, row);
    }
  }
  const data = [...rows.values()].sort((a, b) => a.ts - b.ts);
  const spanMs = data.length > 1 ? data[data.length - 1].ts - data[0].ts : 0;
  const multiDay = spanMs > 36 * 60 * 60 * 1000;
  const hasRight = series.some((s) => s.right);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: hasRight ? 0 : 8, left: -8, bottom: 0 }}>
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
          yAxisId="left"
          tickLine={false}
          axisLine={false}
          width={52}
          domain={['auto', 'auto']}
          label={leftUnit ? { value: leftUnit, angle: -90, position: 'insideLeft', offset: 18, fill: '#64748b', fontSize: 10 } : undefined}
        />
        {hasRight && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={44}
            domain={['auto', 'auto']}
            label={rightUnit ? { value: rightUnit, angle: 90, position: 'insideRight', offset: 12, fill: '#64748b', fontSize: 10 } : undefined}
          />
        )}
        <Tooltip
          contentStyle={{ background: 'var(--chart-tooltip-bg)', color: 'var(--chart-tooltip-fg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }}
          labelFormatter={(v) => fmtShortDateTime(v as number)}
          formatter={(v: number, name) => [fmtNumber(v, decimals), name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
        {series.map((s) => (
          <Line
            key={s.key}
            yAxisId={s.right ? 'right' : 'left'}
            dataKey={s.key}
            name={s.name}
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
