'use client';

import { Gauge } from '@/components/charts/Gauge';
import { useLiveReading } from '@/components/providers/RealtimeProvider';
import { SENSOR_META } from '@/lib/sensors';
import type { SensorWithLatest } from '@/types';

/** Gauge bound to a sensor's live value. */
export function LiveGauge({ sensor }: { sensor: SensorWithLatest }) {
  const meta = SENSOR_META[sensor.type];
  const reading = useLiveReading(sensor.id, sensor.latest);
  return (
    <Gauge
      value={reading?.value ?? null}
      min={meta.range[0]}
      max={meta.range[1]}
      lowThreshold={sensor.minThreshold}
      highThreshold={sensor.maxThreshold}
      label={sensor.label}
      unit={sensor.unit}
      color={meta.color}
      decimals={meta.decimals}
    />
  );
}
