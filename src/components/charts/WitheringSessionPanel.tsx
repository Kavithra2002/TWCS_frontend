'use client';

import { useState } from 'react';
import { LiveMetricsPanel } from './LiveMetricsPanel';
import { WitherRunTable } from './WitherRunTable';
import { WitherWeightChart } from './WitherWeightChart';
import type { TimeSeriesPoint, WitherSnapshotPoint } from '@/lib/moc-run';

interface Props {
  timeSeriesPoints: TimeSeriesPoint[];
  chartPoints: WitherSnapshotPoint[];
  surfaceEndHour: number;
}

/**
 * Owns the playback index so LiveMetricsPanel, WitherWeightChart, and
 * WitherRunTable all stay in sync — the chart line grows step by step
 * as the scrubber advances.
 */
export function WitheringSessionPanel({ timeSeriesPoints, chartPoints, surfaceEndHour }: Props) {
  const [idx, setIdx] = useState(0);

  // Fix both axes using the full dataset so they never rescale during playback.
  const maxHour = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1].hour : 14;
  const allWeights = chartPoints.map((p) => p.weightKg);
  const wMin = allWeights.length > 0 ? Math.min(...allWeights) : 0;
  const wMax = allWeights.length > 0 ? Math.max(...allWeights) : 1;
  const pad = (wMax - wMin) * 0.04;
  const yDomain: [number, number] = [Math.floor(wMin - pad), Math.ceil(wMax + pad)];

  // Slice both datasets to the current step so everything updates together.
  // Both arrays come from the same JSON in the same order, so indices match.
  const visibleChartPoints = chartPoints.slice(0, idx + 1);

  return (
    <>
      <LiveMetricsPanel points={timeSeriesPoints} idx={idx} onIdxChange={setIdx} showControls />
      <WitherWeightChart
        points={visibleChartPoints}
        allPoints={chartPoints}
        surfaceEndHour={surfaceEndHour}
        maxHour={maxHour}
        yDomain={yDomain}
      />
      <WitherRunTable points={visibleChartPoints} surfaceEndHour={surfaceEndHour} />
    </>
  );
}
