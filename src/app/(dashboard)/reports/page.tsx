'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Download } from 'lucide-react';
import { MultiSeriesChart } from '@/components/charts/MultiSeriesChart';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, Loading } from '@/components/ui/States';
import { TIME_RANGE_OPTIONS, TIME_RANGES, useSeries, type TimeRange } from '@/hooks/useSeries';
import { api, qs } from '@/lib/api';
import { fmtNumber } from '@/lib/format';
import { SENSOR_META, SENSOR_ORDER } from '@/lib/sensors';
import type { SensorType, SeriesResponse, TroughWithLive } from '@/types';

const COMPARE_COLORS = ['#22c55e', '#38bdf8', '#f97316', '#a78bfa', '#facc15', '#fb7185', '#2dd4bf', '#e879f9'];

export default function ReportsPage() {
  const { data: troughs } = useSWR<TroughWithLive[]>('/troughs');
  const [troughId, setTroughId] = useState<string>('');
  const [type, setType] = useState<SensorType>('LEAF_MOISTURE');
  const [range, setRange] = useState<TimeRange>('24h');

  useEffect(() => {
    if (!troughId && troughs?.length) setTroughId(troughs[0].id);
  }, [troughs, troughId]);

  const meta = SENSOR_META[type];
  const trough = troughs?.find((t) => t.id === troughId);
  const sensor = trough?.sensors.find((s) => s.type === type);
  const { data: series, isLoading } = useSeries(sensor?.id, range, 300);

  const compareTargets = (troughs ?? [])
    .map((t) => ({ trough: t, sensor: t.sensors.find((s) => s.type === type) }))
    .filter((x): x is { trough: TroughWithLive; sensor: NonNullable<typeof x.sensor> } => !!x.sensor);

  const { data: comparison } = useSWR(
    compareTargets.length ? ['compare', type, range, compareTargets.map((c) => c.sensor.id).join(',')] : null,
    () =>
      Promise.all(
        compareTargets.map((c) =>
          api<SeriesResponse>(
            `/telemetry/series${qs({ sensorId: c.sensor.id, from: new Date(Date.now() - TIME_RANGES[range].ms).toISOString(), points: 150 })}`,
          ),
        ),
      ),
    { keepPreviousData: true },
  );

  const exportCsv = () => {
    if (!series || !trough) return;
    const header = 'timestamp,avg,min,max,unit\n';
    const rows = series.points.map((p) => `${p.t},${p.avg},${p.min},${p.max},${series.sensor.unit}`).join('\n');
    const url = URL.createObjectURL(new Blob([header + rows], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `twcs_${trough.code}_${type.toLowerCase()}_${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = series?.summary;
  const bucket = series ? (series.bucketSeconds >= 3600 ? `${fmtNumber(series.bucketSeconds / 3600, 1)} h` : `${Math.round(series.bucketSeconds / 60) || 1} min`) : '—';

  return (
    <>
      <PageHeader
        title="Reports & analysis"
        description="Historical sensor data, trough comparison and CSV export"
        actions={
          <>
            <select className="input w-auto py-1.5 text-xs" value={troughId} onChange={(e) => setTroughId(e.target.value)}>
              {troughs?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code}
                </option>
              ))}
            </select>
            <select className="input w-auto py-1.5 text-xs" value={type} onChange={(e) => setType(e.target.value as SensorType)}>
              {SENSOR_ORDER.map((t) => (
                <option key={t} value={t}>
                  {SENSOR_META[t].label}
                </option>
              ))}
            </select>
            <Segmented value={range} options={TIME_RANGE_OPTIONS} onChange={setRange} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Minimum" value={fmtNumber(s?.min, meta.decimals)} unit={meta.unit} />
        <Stat label="Average" value={fmtNumber(s?.avg, meta.decimals)} unit={meta.unit} />
        <Stat label="Maximum" value={fmtNumber(s?.max, meta.decimals)} unit={meta.unit} />
        <Stat label="Samples" value={s ? s.samples.toLocaleString() : '—'} />
        <Stat label="Resolution" value={bucket} />
      </div>

      <Card
        className="mt-4"
        title={`${trough?.code ?? ''} · ${meta.label}`}
        subtitle="Line = bucket average, shaded band = min–max within each bucket, dashed = alert thresholds"
        action={
          <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!series?.points.length}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        }
      >
        {isLoading && !series ? (
          <Loading />
        ) : series && series.points.length > 0 ? (
          <TimeSeriesChart
            points={series.points}
            color={meta.color}
            unit={meta.unit}
            decimals={meta.decimals}
            minThreshold={sensor?.minThreshold}
            maxThreshold={sensor?.maxThreshold}
            height={320}
          />
        ) : (
          <EmptyState title="No data for this selection" />
        )}
      </Card>

      <Card className="mt-4" title={`Trough comparison · ${meta.label}`} subtitle="Average per trough over the selected period">
        {!comparison ? (
          <Loading />
        ) : (
          <MultiSeriesChart
            height={300}
            decimals={meta.decimals}
            leftUnit={meta.unit}
            series={comparison.map((c, i) => ({
              key: compareTargets[i]?.trough.code ?? String(i),
              name: compareTargets[i]?.trough.code ?? String(i),
              color: COMPARE_COLORS[i % COMPARE_COLORS.length],
              points: c.points,
            }))}
          />
        )}
      </Card>
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-50">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>}
      </p>
    </div>
  );
}
