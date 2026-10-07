import clsx from 'clsx';
import { Card } from '@/components/ui/Card';
import { fmtNumber, fmtShortDateTime } from '@/lib/format';
import type { WitherSnapshotPoint } from '@/lib/moc-run';

function fmtHour(hour: number): string {
  return hour.toFixed(2);
}

function cell(value: number | null, decimals: number): string {
  return value == null ? '—' : fmtNumber(value, decimals);
}

/** Every probe sample, in the same order and units as the weight chart. */
export function WitherRunTable({ points, surfaceEndHour }: { points: WitherSnapshotPoint[]; surfaceEndHour: number }) {
  const surfaceIndex =
    points.length === 0
      ? -1
      : points.reduce((best, point, index) => {
          return Math.abs(point.hour - surfaceEndHour) < Math.abs(points[best].hour - surfaceEndHour) ? index : best;
        }, 0);

  return (
    <Card
      className="mt-4"
      title="Sample table"
      subtitle={`${points.length} samples shown. Weight is 1,500 kg × wither standard. Marked row is closest to SMR done.`}
      bodyClassName="p-0"
    >
      <div className="max-h-[32rem] overflow-auto">
        <table className="table-base">
          <thead className="sticky top-0 z-10 bg-slate-900">
            <tr>
              <th className="text-right">Elapsed (h)</th>
              <th>Clock</th>
              <th className="text-right">Weight (kg)</th>
              <th className="text-right">Wither standard (%)</th>
              <th className="text-right">Ambient louver (%)</th>
              <th className="text-right">Hot louver (%)</th>
              <th className="text-right">Fan speed (Hz)</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => {
              const marked = index === surfaceIndex;
              return (
                <tr key={point.file} className={clsx(marked && 'bg-slate-800/50')}>
                  <td className="text-right tabular-nums">{fmtHour(point.hour)}</td>
                  <td className="tabular-nums text-slate-400">{fmtShortDateTime(point.file)}</td>
                  <td className="text-right tabular-nums">{fmtNumber(point.weightKg, 1)}</td>
                  <td className="text-right tabular-nums">{fmtNumber(point.wsPct, 2)}</td>
                  <td className="text-right tabular-nums">{cell(point.ambLouverPct, 1)}</td>
                  <td className="text-right tabular-nums">{cell(point.hotLouverPct, 1)}</td>
                  <td className="text-right tabular-nums">{cell(point.fanHz, 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
