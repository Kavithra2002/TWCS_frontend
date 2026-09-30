'use client';

import useSWR from 'swr';
import { api, qs } from '@/lib/api';
import type { SeriesResponse } from '@/types';

export const TIME_RANGES = {
  '1h': { label: '1H', ms: 60 * 60 * 1000 },
  '6h': { label: '6H', ms: 6 * 60 * 60 * 1000 },
  '24h': { label: '24H', ms: 24 * 60 * 60 * 1000 },
  '7d': { label: '7D', ms: 7 * 24 * 60 * 60 * 1000 },
  '30d': { label: '30D', ms: 30 * 24 * 60 * 60 * 1000 },
} as const;

export type TimeRange = keyof typeof TIME_RANGES;

export const TIME_RANGE_OPTIONS = (Object.keys(TIME_RANGES) as TimeRange[]).map((value) => ({
  value,
  label: TIME_RANGES[value].label,
}));

/**
 * Bucketed history for one sensor. `from` is computed at fetch time so the
 * window slides forward on every revalidation.
 */
export function useSeries(sensorId: string | undefined, range: TimeRange, points = 180) {
  return useSWR<SeriesResponse>(
    sensorId ? ['series', sensorId, range, points] : null,
    () =>
      api<SeriesResponse>(
        `/telemetry/series${qs({
          sensorId,
          from: new Date(Date.now() - TIME_RANGES[range].ms).toISOString(),
          points,
        })}`,
      ),
    { refreshInterval: range === '1h' ? 15_000 : 60_000, keepPreviousData: true },
  );
}
