'use client';

import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { Card } from '@/components/ui/Card';
import { EmptyState, Loading } from '@/components/ui/States';
import { useSeries, type TimeRange } from '@/hooks/useSeries';
import { fmtNumber } from '@/lib/format';
import { SENSOR_META } from '@/lib/sensors';
import type { Sensor } from '@/types';

export function SensorChartCard({ sensor, range, height = 200 }: { sensor: Sensor; range: TimeRange; height?: number }) {
  const meta = SENSOR_META[sensor.type];
  const { data, isLoading } = useSeries(sensor.id, range);
  const Icon = meta.icon;
  const s = data?.summary;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: meta.color }} />
          {sensor.label}
        </span>
      }
      action={
        s && (
          <div className="flex gap-3 text-[11px] tabular-nums text-slate-400">
            <span>min {fmtNumber(s.min, meta.decimals)}</span>
            <span className="text-slate-200">avg {fmtNumber(s.avg, meta.decimals)}</span>
            <span>max {fmtNumber(s.max, meta.decimals)}</span>
          </div>
        )
      }
      bodyClassName="p-2 pt-3"
    >
      {isLoading && !data ? (
        <Loading />
      ) : data && data.points.length > 0 ? (
        <TimeSeriesChart
          points={data.points}
          color={meta.color}
          unit={sensor.unit}
          decimals={meta.decimals}
          minThreshold={sensor.minThreshold}
          maxThreshold={sensor.maxThreshold}
          height={height}
        />
      ) : (
        <EmptyState title="No readings in this period" />
      )}
    </Card>
  );
}
