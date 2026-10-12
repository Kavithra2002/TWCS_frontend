'use client';

import clsx from 'clsx';
import { Card } from '@/components/ui/Card';
import { fmtNumber, fmtShortDateTime } from '@/lib/format';
import { rangeState, type SensorMeta } from '@/lib/sensors';
import type { SeriesPoint } from '@/types';

export interface ReportTableRow {
  key: string;
  time: string;
  troughCode: string;
  avg: number;
  min: number;
  max: number;
  minThreshold: number | null;
  maxThreshold: number | null;
}

interface Props {
  rows: ReportTableRow[];
  meta: SensorMeta;
  /** Overall average across the visible selection — used for % of period avg. */
  periodAvg: number | null;
}

function statusLabel(avg: number, minT: number | null, maxT: number | null): { text: string; className: string } {
  const state = rangeState(avg, { minThreshold: minT, maxThreshold: maxT });
  if (state === 'low') return { text: 'Below min', className: 'text-amber-600' };
  if (state === 'high') return { text: 'Above max', className: 'text-red-600' };
  if (state === 'ok') return { text: 'In range', className: 'text-emerald-700' };
  return { text: '—', className: 'text-[#111827]/40' };
}

export function ReportDataTable({ rows, meta, periodAvg }: Props) {
  return (
    <Card
      className="mt-4"
      title="Detailed readings"
      subtitle={`${rows.length.toLocaleString()} bucket rows · avg / min / max, span, % of period average, threshold status`}
      bodyClassName="p-0"
    >
      <div className="max-h-[28rem] overflow-auto">
        <table className="table-base">
          <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm">
            <tr>
              <th>Time</th>
              <th>Trough</th>
              <th className="text-right">Avg ({meta.unit})</th>
              <th className="text-right">Min</th>
              <th className="text-right">Max</th>
              <th className="text-right">Span</th>
              <th className="text-right">% of avg</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-[#111827]/50">
                  No rows for this selection.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const span = row.max - row.min;
                const pct =
                  periodAvg != null && periodAvg !== 0 ? (row.avg / periodAvg) * 100 : null;
                const status = statusLabel(row.avg, row.minThreshold, row.maxThreshold);
                return (
                  <tr key={row.key}>
                    <td className="tabular-nums text-[#111827]/70">{fmtShortDateTime(row.time)}</td>
                    <td className="font-medium tabular-nums">{row.troughCode}</td>
                    <td className="text-right tabular-nums">{fmtNumber(row.avg, meta.decimals)}</td>
                    <td className="text-right tabular-nums text-[#111827]/65">{fmtNumber(row.min, meta.decimals)}</td>
                    <td className="text-right tabular-nums text-[#111827]/65">{fmtNumber(row.max, meta.decimals)}</td>
                    <td className="text-right tabular-nums text-[#111827]/65">{fmtNumber(span, meta.decimals)}</td>
                    <td className="text-right tabular-nums">
                      {pct == null ? '—' : `${fmtNumber(pct, 1)}%`}
                    </td>
                    <td className={clsx('text-xs font-medium', status.className)}>{status.text}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Flatten series responses into table rows (newest first). */
export function buildReportRows(
  items: {
    troughCode: string;
    minThreshold: number | null;
    maxThreshold: number | null;
    points: SeriesPoint[];
  }[],
): ReportTableRow[] {
  const rows: ReportTableRow[] = [];
  for (const item of items) {
    for (const p of item.points) {
      rows.push({
        key: `${item.troughCode}-${p.t}`,
        time: p.t,
        troughCode: item.troughCode,
        avg: p.avg,
        min: p.min,
        max: p.max,
        minThreshold: item.minThreshold,
        maxThreshold: item.maxThreshold,
      });
    }
  }
  return rows.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}
