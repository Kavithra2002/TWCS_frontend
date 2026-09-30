'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Save } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Loading } from '@/components/ui/States';
import { api, API_URL } from '@/lib/api';
import { canPlan } from '@/lib/auth';
import { SENSOR_META, sortSensors } from '@/lib/sensors';
import type { Sensor, TroughWithLive } from '@/types';

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: troughs, mutate } = useSWR<TroughWithLive[]>('/troughs');
  const [troughId, setTroughId] = useState('');

  useEffect(() => {
    if (!troughId && troughs?.length) setTroughId(troughs[0].id);
  }, [troughs, troughId]);

  const trough = troughs?.find((t) => t.id === troughId);
  const editable = canPlan(user);

  return (
    <>
      <PageHeader title="Settings" description="Alert thresholds, account and device integration" />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          title="Sensor alert thresholds"
          subtitle={editable ? 'Readings outside these limits raise alerts' : 'Only admins and supervisors can edit thresholds'}
          className="xl:col-span-2"
          action={
            <select className="input w-auto py-1 text-xs" value={troughId} onChange={(e) => setTroughId(e.target.value)}>
              {troughs?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code}
                </option>
              ))}
            </select>
          }
          bodyClassName="p-0"
        >
          {!trough ? (
            <Loading />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Sensor</th>
                    <th>Unit</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sortSensors(trough.sensors).map((s) => (
                    <ThresholdRow key={s.id} sensor={s} editable={editable} onSaved={() => mutate()} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Account">
            <dl className="space-y-2 text-sm">
              <Row label="Name" value={user?.name} />
              <Row label="Email" value={user?.email} />
              <Row label="Role" value={user?.role} />
            </dl>
          </Card>
          <Card title="Device integration" subtitle="How PLCs / IoT gateways push readings">
            <p className="mb-2 text-xs text-slate-400">
              <code className="text-tea-300">POST {API_URL}/telemetry/readings</code> with header{' '}
              <code className="text-tea-300">x-device-key</code>:
            </p>
            <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-300">
{`{
  "readings": [
    { "sensorId": "<sensor id>", "value": 28.4 },
    { "sensorId": "<sensor id>", "value": 71.2,
      "recordedAt": "2026-01-01T06:00:00Z" }
  ]
}`}
            </pre>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value ?? '—'}</dd>
    </div>
  );
}

function ThresholdRow({ sensor, editable, onSaved }: { sensor: Sensor; editable: boolean; onSaved: () => void }) {
  const meta = SENSOR_META[sensor.type];
  const Icon = meta.icon;
  const [min, setMin] = useState(sensor.minThreshold?.toString() ?? '');
  const [max, setMax] = useState(sensor.maxThreshold?.toString() ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | string>('idle');

  useEffect(() => {
    setMin(sensor.minThreshold?.toString() ?? '');
    setMax(sensor.maxThreshold?.toString() ?? '');
  }, [sensor.minThreshold, sensor.maxThreshold]);

  const dirty = min !== (sensor.minThreshold?.toString() ?? '') || max !== (sensor.maxThreshold?.toString() ?? '');

  const save = async () => {
    setState('saving');
    try {
      await api(`/sensors/${sensor.id}`, {
        method: 'PATCH',
        json: { minThreshold: min === '' ? null : Number(min), maxThreshold: max === '' ? null : Number(max) },
      });
      setState('saved');
      onSaved();
    } catch (e) {
      setState(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <tr>
      <td>
        <span className="flex items-center gap-2 text-slate-200">
          <Icon className="h-4 w-4" style={{ color: meta.color }} />
          {sensor.label}
        </span>
      </td>
      <td className="text-slate-400">{sensor.unit}</td>
      <td>
        <input type="number" step="any" className="input w-28 py-1" value={min} disabled={!editable} onChange={(e) => setMin(e.target.value)} />
      </td>
      <td>
        <input type="number" step="any" className="input w-28 py-1" value={max} disabled={!editable} onChange={(e) => setMax(e.target.value)} />
      </td>
      <td className="whitespace-nowrap text-right">
        {editable && (
          <Button size="sm" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty || state === 'saving'} onClick={save}>
            <Save className="h-3 w-3" /> Save
          </Button>
        )}
        {state === 'saved' && !dirty && <span className="ml-2 text-xs text-emerald-400">Saved</span>}
        {state !== 'idle' && state !== 'saving' && state !== 'saved' && <span className="ml-2 text-xs text-red-400">{state}</span>}
      </td>
    </tr>
  );
}
