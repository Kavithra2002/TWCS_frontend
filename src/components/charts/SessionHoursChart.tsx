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
import { fmtNumber } from '@/lib/format';
import type { SeriesPoint } from '@/types';

export interface HourSeries {
  key: string;
  name: string;
  color: string;
  points: SeriesPoint[];
}

interface SessionHoursChartProps {
  series: HourSeries[];
  /** Session window on the X axis (hours). */
  xMaxHours: number;
  yDomain: [number, number];
  unit: string;
  decimals?: number;
  height?: number;
  showLegend?: boolean;
  /** Absolute session start; when omitted, hours are relative to the earliest point. */
  sessionStartMs?: number | null;
}

function emptyAxisRows(maxHours: number): Record<string, number>[] {
  const end = Math.max(1, Math.ceil(maxHours));
  const rows: Record<string, number>[] = [];
  for (let h = 0; h <= end; h += 1) rows.push({ h });
  return rows;
}

/** Hour-based session chart: axes always render; lines appear only when points exist. */
export function SessionHoursChart({
  series,
  xMaxHours,
  yDomain,
  unit,
  decimals = 1,
  height = 260,
  showLegend = true,
  sessionStartMs,
}: SessionHoursChartProps) {
  const hasLines = series.some((s) => s.points.length > 0);
  const xMax = Math.max(xMaxHours, 1);
  const xStep = Math.max(1, Math.round(xMax / 7));
  const xTicks = Array.from({ length: Math.floor(xMax) + 1 }, (_, i) => i).filter(
    (h) => h % xStep === 0 || h === Math.floor(xMax),
  );

  let chartRows: Record<string, number>[];
  if (!hasLines) {
    chartRows = emptyAxisRows(xMax);
  } else {
    const origin =
      sessionStartMs != null && Number.isFinite(sessionStartMs)
        ? sessionStartMs
        : Math.min(
            ...series.flatMap((s) => s.points.map((p) => Date.parse(p.t))).filter(Number.isFinite),
          );
    const byH = new Map<number, Record<string, number>>();
    for (const s of series) {
      for (const p of s.points) {
        const ts = Date.parse(p.t);
        if (!Number.isFinite(ts)) continue;
        const h = Math.round(((ts - origin) / 3_600_000) * 100) / 100;
        if (h < 0 || h > xMax + 0.05) continue;
        const row = byH.get(h) ?? { h };
        row[s.key] = p.avg;
        byH.set(h, row);
      }
    }
    chartRows = [...byH.values()].sort((a, b) => a.h - b.h);
    if (!chartRows.length) chartRows = emptyAxisRows(xMax);
  }

  const legendItems = series.map((s) => ({ id: s.key, label: s.name, color: s.color }));

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
          tickFormatter={(v: number) => fmtNumber(v, decimals === 0 ? 0 : 1)}
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
          contentStyle={{
            background: 'var(--chart-tooltip-bg)',
            color: 'var(--chart-tooltip-fg)',
            border: '1px solid var(--chart-tooltip-border)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => `${Number(v).toFixed(2)} h elapsed`}
          formatter={(v: number, name: string) => [
            fmtNumber(v, decimals),
            legendItems.find((s) => s.id === name)?.label ?? name,
          ]}
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
            formatter={(value) => legendItems.find((s) => s.id === value)?.label ?? value}
          />
        )}
        {hasLines &&
          series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.key}
              stroke={s.color}
              strokeWidth={2}
              connectNulls
              dot={false}
              isAnimationActive={false}
            />
          ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
