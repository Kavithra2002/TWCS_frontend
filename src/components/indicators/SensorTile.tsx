'use client';

import clsx from 'clsx';
import { useLiveReading } from '@/components/providers/RealtimeProvider';
import { fmtAgo, fmtNumber } from '@/lib/format';
import { rangeState, SENSOR_META } from '@/lib/sensors';
import type { SensorWithLatest } from '@/types';

const STATE_STYLE = {
  ok: 'bg-emerald-400',
  low: 'bg-amber-400',
  high: 'bg-red-500',
  unknown: 'bg-slate-600',
};

/** Compact live indicator: value, threshold state and position within the allowed band. */
export function SensorTile({ sensor, compact }: { sensor: SensorWithLatest; compact?: boolean }) {
  const meta = SENSOR_META[sensor.type];
  const reading = useLiveReading(sensor.id, sensor.latest);
  const value = reading?.value ?? null;
  const state = rangeState(value, sensor);
  const Icon = meta.icon;

  const [lo, hi] = meta.range;
  const pos = value === null ? 0 : Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100));
  const bandLeft = sensor.minThreshold != null ? ((sensor.minThreshold - lo) / (hi - lo)) * 100 : 0;
  const bandRight = sensor.maxThreshold != null ? ((sensor.maxThreshold - lo) / (hi - lo)) * 100 : 100;

  return (
    <div className={clsx('rounded-lg border border-slate-800 bg-slate-950/50', compact ? 'p-2.5' : 'p-3')}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
          {compact ? meta.short : sensor.label}
        </span>
        <span className={clsx('h-2 w-2 rounded-full', STATE_STYLE[state])} title={state} />
      </div>
      <p className={clsx('mt-1 font-semibold tabular-nums text-slate-50', compact ? 'text-lg' : 'text-2xl')}>
        {fmtNumber(value, meta.decimals)}
        <span className="ml-1 text-xs font-normal text-slate-500">{sensor.unit}</span>
      </p>
      {!compact && (
        <>
          <div className="relative mt-2 h-1.5 rounded-full bg-slate-800">
            <div
              className="absolute inset-y-0 rounded-full bg-emerald-500/25"
              style={{ left: `${Math.max(0, bandLeft)}%`, width: `${Math.max(0, Math.min(100, bandRight) - Math.max(0, bandLeft))}%` }}
            />
            {value !== null && (
              <div
                className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${pos}%`, backgroundColor: state === 'ok' ? meta.color : '#ef4444' }}
              />
            )}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
            <span>
              {sensor.minThreshold ?? '—'} – {sensor.maxThreshold ?? '—'} {sensor.unit}
            </span>
            <span>{reading ? fmtAgo(reading.recordedAt) : 'no data'}</span>
          </div>
        </>
      )}
    </div>
  );
}
