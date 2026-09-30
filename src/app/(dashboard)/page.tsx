'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { Bell, Droplets, Layers, Leaf, Scale, Thermometer } from 'lucide-react';
import { AlertList } from '@/components/alerts/AlertList';
import { MultiSeriesChart } from '@/components/charts/MultiSeriesChart';
import { StatusDonut } from '@/components/charts/StatusDonut';
import { KpiCard } from '@/components/indicators/KpiCard';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { TroughCard } from '@/components/troughs/TroughCard';
import { TIME_RANGE_OPTIONS, useSeries, type TimeRange } from '@/hooks/useSeries';
import { fmtNumber } from '@/lib/format';
import { SCHEDULE_ACTION_STYLE, SENSOR_META, TROUGH_STATUS_STYLE } from '@/lib/sensors';
import type { DashboardOverview, TodaySchedules, TroughWithLive } from '@/types';

export default function DashboardPage() {
  const { data, error } = useSWR<DashboardOverview>('/dashboard/overview', { refreshInterval: 30_000 });

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label="Loading dashboard…" />;

  const { kpis } = data;
  const avg = kpis.averages;

  return (
    <>
      <PageHeader title="Factory overview" description="Live withering conditions across all troughs" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Running troughs" value={`${kpis.troughs.running}/${kpis.troughs.total}`} icon={Layers} hint={`${kpis.troughs.idle} idle · ${kpis.troughs.maintenance} maint.`} />
        <KpiCard label="Avg air temp" value={fmtNumber(avg.airTemperature)} unit="°C" icon={Thermometer} color={SENSOR_META.AIR_TEMPERATURE.color} hint={`Leaf ${fmtNumber(avg.leafTemperature)} °C`} />
        <KpiCard label="Avg humidity" value={fmtNumber(avg.humidity)} unit="%RH" icon={Droplets} color={SENSOR_META.HUMIDITY.color} />
        <KpiCard label="Avg leaf moisture" value={fmtNumber(avg.leafMoisture)} unit="%" icon={Leaf} color={SENSOR_META.LEAF_MOISTURE.color} />
        <KpiCard label="Active batches" value={kpis.activeBatches} icon={Scale} color="#a78bfa" hint={`${fmtNumber(kpis.leafInProcessKg, 0)} kg green leaf`} />
        <KpiCard label="Open alerts" value={kpis.openAlerts} icon={Bell} color="#ef4444" alert={kpis.openAlerts > 0} hint={<Link href="/alerts" className="hover:text-slate-300">View all →</Link>} />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-3 xl:items-stretch">
        <div className="space-y-4 xl:col-span-2">
          <Card title="Withering troughs" subtitle="Live readings · click a trough for details">
            <div className="grid gap-3 md:grid-cols-2">
              {data.troughs.map((t) => (
                <TroughCard key={t.id} trough={t} activeBatch={t.activeBatch} />
              ))}
            </div>
          </Card>
          <ClimateTrend troughs={data.troughs} />
        </div>

        <div className="flex flex-col gap-4 xl:min-h-0">
          <Card title="Trough status">
            <StatusDonut
              centerValue={String(kpis.troughs.total)}
              centerLabel="troughs"
              slices={[
                { name: 'Running', value: kpis.troughs.running, color: TROUGH_STATUS_STYLE.RUNNING.color },
                { name: 'Idle', value: kpis.troughs.idle, color: TROUGH_STATUS_STYLE.IDLE.color },
                { name: 'Maintenance', value: kpis.troughs.maintenance, color: TROUGH_STATUS_STYLE.MAINTENANCE.color },
                { name: 'Offline', value: kpis.troughs.offline, color: TROUGH_STATUS_STYLE.OFFLINE.color },
              ]}
            />
          </Card>
          <Card title="Open alerts" action={<Link href="/alerts" className="text-xs text-tea-400 hover:text-tea-300">All alerts</Link>}>
            <AlertList alerts={data.recentAlerts} />
          </Card>
          <TodaySchedule />
        </div>
      </div>
    </>
  );
}

function ClimateTrend({ troughs }: { troughs: TroughWithLive[] }) {
  const [troughId, setTroughId] = useState(troughs.find((t) => t.status === 'RUNNING')?.id ?? troughs[0]?.id);
  const [range, setRange] = useState<TimeRange>('6h');
  const trough = troughs.find((t) => t.id === troughId);
  const sensorId = (type: string) => trough?.sensors.find((s) => s.type === type)?.id;

  const temp = useSeries(sensorId('AIR_TEMPERATURE'), range);
  const humidity = useSeries(sensorId('HUMIDITY'), range);
  const moisture = useSeries(sensorId('LEAF_MOISTURE'), range);

  return (
    <Card
      title="Climate trend"
      subtitle="Air temperature (left axis) vs humidity & leaf moisture (right axis)"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto py-1 text-xs" value={troughId} onChange={(e) => setTroughId(e.target.value)}>
            {troughs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code}
              </option>
            ))}
          </select>
          <Segmented value={range} options={TIME_RANGE_OPTIONS.slice(0, 4)} onChange={setRange} />
        </div>
      }
    >
      {!temp.data && temp.isLoading ? (
        <Loading />
      ) : (
        <MultiSeriesChart
          leftUnit="°C"
          rightUnit="%"
          series={[
            { key: 'temp', name: 'Air temp (°C)', color: SENSOR_META.AIR_TEMPERATURE.color, points: temp.data?.points ?? [] },
            { key: 'hum', name: 'Humidity (%RH)', color: SENSOR_META.HUMIDITY.color, points: humidity.data?.points ?? [], right: true },
            { key: 'moist', name: 'Leaf moisture (%)', color: SENSOR_META.LEAF_MOISTURE.color, points: moisture.data?.points ?? [], right: true },
          ]}
        />
      )}
    </Card>
  );
}

function TodaySchedule() {
  const { data } = useSWR<TodaySchedules>('/schedules/today', { refreshInterval: 60_000 });
  const items = data?.items ?? [];
  const STATE = {
    ACTIVE: 'text-emerald-300',
    UPCOMING: 'text-sky-300',
    DONE: 'text-slate-500',
  };

  return (
    <Card
      title="Today's schedule"
      subtitle={data ? `Factory time ${data.now} (${data.timeZone})` : undefined}
      action={<Link href="/schedules" className="text-xs text-tea-400 hover:text-tea-300">Manage</Link>}
      className="flex min-h-0 flex-1 flex-col"
      bodyClassName="min-h-0 flex-1 overflow-y-auto"
    >
      {!data ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing scheduled today" />
      ) : (
        <ul className="space-y-1.5 pr-1">
          {items.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg bg-slate-950/50 px-3 py-2">
              <span className="h-8 w-1 rounded-full" style={{ backgroundColor: SCHEDULE_ACTION_STYLE[s.action].color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">
                  <span className="font-medium text-slate-50">{s.troughCode}</span> · {s.name}
                </p>
                <p className="text-xs tabular-nums text-slate-500">
                  {s.startTime}–{s.endTime} · {SCHEDULE_ACTION_STYLE[s.action].label}
                </p>
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${STATE[s.state]}`}>{s.state}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
