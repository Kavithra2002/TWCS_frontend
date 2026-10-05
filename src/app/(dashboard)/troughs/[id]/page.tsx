'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { ArrowLeft, Plus } from 'lucide-react';
import { AlertList } from '@/components/alerts/AlertList';
import { BatchActions } from '@/components/batches/BatchActions';
import { BatchFormModal } from '@/components/batches/BatchFormModal';
import { LiveGauge } from '@/components/indicators/LiveGauge';
import { MoistureProgress } from '@/components/indicators/MoistureProgress';
import { SensorTile } from '@/components/indicators/SensorTile';
import { useAuth } from '@/components/providers/AuthProvider';
import { useLiveReading } from '@/components/providers/RealtimeProvider';
import { ScheduleTimeline } from '@/components/schedules/ScheduleTimeline';
import { SensorChartCard } from '@/components/troughs/SensorChartCard';
import { BatchStatusBadge, TroughStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { TIME_RANGE_OPTIONS, type TimeRange } from '@/hooks/useSeries';
import { api } from '@/lib/api';
import { canOperate } from '@/lib/auth';
import { fmtDateTime, fmtNumber, WEEKDAY_SHORT } from '@/lib/format';
import { sortSensors, TROUGH_STATUS_STYLE } from '@/lib/sensors';
import type { Alert, Batch, Schedule, SensorType, TroughStatus, TroughWithLive } from '@/types';

const GAUGE_TYPES: SensorType[] = ['AIR_TEMPERATURE', 'LEAF_TEMPERATURE', 'HUMIDITY', 'LEAF_MOISTURE'];

export default function TroughDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [range, setRange] = useState<TimeRange>('6h');
  const [batchModal, setBatchModal] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const { data: trough, error, mutate } = useSWR<TroughWithLive>(`/troughs/${id}`);
  const { data: batches, mutate: mutateBatches } = useSWR<Batch[]>(`/batches?troughId=${id}&limit=10`);
  const { data: schedules } = useSWR<Schedule[]>(`/schedules?troughId=${id}`);
  const { data: alerts } = useSWR<Alert[]>(`/alerts?troughId=${id}&limit=10`);

  if (error) return <ErrorState error={error} />;
  if (!trough) return <Loading />;

  const sensors = sortSensors(trough.sensors);
  const gaugeSensors = sensors.filter((s) => GAUGE_TYPES.includes(s.type));
  const tileSensors = sensors.filter((s) => !GAUGE_TYPES.includes(s.type));
  const activeBatch = batches?.find((b) => b.status === 'WITHERING');

  const setStatus = async (status: TroughStatus) => {
    try {
      await api(`/troughs/${id}/status`, { method: 'PATCH', json: { status } });
      mutate();
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  const refreshBatches = () => {
    mutateBatches();
    mutate();
  };

  return (
    <>
      <Link href="/troughs" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-3 w-3" /> All troughs
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-50">
            {trough.code} <span className="font-normal text-slate-400">· {trough.name}</span>
          </h1>
          <TroughStatusBadge status={trough.status} />
        </div>
        <div className="flex items-center gap-2">
          {canOperate(user) && (
            <select className="input w-auto py-1.5 text-xs" value={trough.status} onChange={(e) => setStatus(e.target.value as TroughStatus)}>
              {(Object.keys(TROUGH_STATUS_STYLE) as TroughStatus[]).map((s) => (
                <option key={s} value={s}>
                  Set {TROUGH_STATUS_STYLE[s].label}
                </option>
              ))}
            </select>
          )}
          <Segmented value={range} options={TIME_RANGE_OPTIONS} onChange={setRange} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Live conditions" className="xl:col-span-2">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {gaugeSensors.map((s) => (
              <LiveGauge key={s.id} sensor={s} />
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {tileSensors.map((s) => (
              <SensorTile key={s.id} sensor={s} />
            ))}
          </div>
        </Card>

        <Card
          title="Current batch"
          action={
            !activeBatch &&
            canOperate(user) && (
              <Button size="sm" onClick={() => setBatchModal(true)}>
                <Plus className="h-3 w-3" /> New batch
              </Button>
            )
          }
        >
          {activeBatch ? (
            <ActiveBatch trough={trough} batch={activeBatch} onChanged={refreshBatches} />
          ) : (
            <EmptyState title="No batch withering" hint="Start a batch to track moisture progress" />
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">Sensor history</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {sensors.map((s) => (
          <SensorChartCard key={s.id} sensor={s} range={range} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card title="Weekly schedule" className="xl:col-span-2" action={<Link href="/schedules" className="text-xs text-tea-400 hover:text-tea-300">Edit</Link>}>
          {schedules ? (
            <ScheduleTimeline
              rows={[1, 2, 3, 4, 5, 6, 0].map((d) => ({
                id: String(d),
                label: WEEKDAY_SHORT[d],
                items: schedules.filter((s) => s.daysOfWeek.includes(d)),
              }))}
            />
          ) : (
            <Loading />
          )}
        </Card>
        <Card title="Recent alerts">{alerts ? <AlertList alerts={alerts} emptyText="No alerts for this trough" /> : <Loading />}</Card>
      </div>

      <Card title="Batch history" className="mt-4" bodyClassName="p-0">
        {batches && batches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Status</th>
                  <th>Intake</th>
                  <th>Moisture</th>
                  <th>Started</th>
                  <th>Ended</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="font-medium text-slate-50">{b.code}</td>
                    <td>
                      <BatchStatusBadge status={b.status} />
                    </td>
                    <td className="tabular-nums">{fmtNumber(b.leafIntakeKg, 0)} kg</td>
                    <td className="tabular-nums">
                      {fmtNumber(b.initialMoisture)}% → {fmtNumber(b.finalMoisture ?? b.currentMoisture)}% (target {fmtNumber(b.targetMoisture)}%)
                    </td>
                    <td className="text-slate-400">{b.startedAt ? fmtDateTime(b.startedAt) : '—'}</td>
                    <td className="text-slate-400">{b.endedAt ? fmtDateTime(b.endedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No batches yet" />
        )}
      </Card>

      <BatchFormModal open={batchModal} onClose={() => setBatchModal(false)} onSaved={refreshBatches} troughs={[trough]} defaultTroughId={trough.id} />
      <ConfirmDialog
        open={statusError !== null}
        title="Couldn't update status"
        description={statusError ?? ''}
        confirmLabel="Close"
        onConfirm={() => undefined}
        onClose={() => setStatusError(null)}
      />
    </>
  );
}

function ActiveBatch({ trough, batch, onChanged }: { trough: TroughWithLive; batch: Batch; onChanged: () => void }) {
  const moistureSensor = trough.sensors.find((s) => s.type === 'LEAF_MOISTURE');
  const live = useLiveReading(moistureSensor?.id, moistureSensor?.latest);

  return (
    <div className="space-y-4">
      <MoistureProgress batch={batch} currentMoisture={live?.value} />
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Started</dt>
          <dd className="text-slate-200">{batch.startedAt ? fmtDateTime(batch.startedAt) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Green leaf</dt>
          <dd className="text-slate-200">{fmtNumber(batch.leafIntakeKg, 0)} kg</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Moisture to remove</dt>
          <dd className="text-slate-200">{fmtNumber(Math.max(0, (live?.value ?? batch.initialMoisture) - batch.targetMoisture))} pts</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Status</dt>
          <dd>
            <BatchStatusBadge status={batch.status} />
          </dd>
        </div>
      </dl>
      {batch.notes && <p className="rounded-lg bg-slate-950/60 p-2 text-xs text-slate-400">{batch.notes}</p>}
      <BatchActions batch={batch} onChanged={onChanged} />
    </div>
  );
}
