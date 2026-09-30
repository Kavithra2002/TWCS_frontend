'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { Check } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { api, qs } from '@/lib/api';
import { canOperate } from '@/lib/auth';
import { fmtAgo, fmtDateTime } from '@/lib/format';
import { SENSOR_META } from '@/lib/sensors';
import type { Alert, AlertSeverity, Trough } from '@/types';

type Status = 'open' | 'acknowledged' | 'all';

export default function AlertsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('open');
  const [severity, setSeverity] = useState<AlertSeverity | ''>('');
  const [troughId, setTroughId] = useState('');
  const { data: troughs } = useSWR<Trough[]>('/troughs');
  const { data, error, mutate } = useSWR<Alert[]>(`/alerts${qs({ status, severity, troughId, limit: 200 })}`, {
    refreshInterval: 30_000,
  });

  const acknowledge = async (a: Alert) => {
    await api(`/alerts/${a.id}/acknowledge`, { method: 'POST' });
    mutate();
  };

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Threshold breaches raised from live sensor readings"
        actions={
          <>
            <select className="input w-auto py-1.5 text-xs" value={troughId} onChange={(e) => setTroughId(e.target.value)}>
              <option value="">All troughs</option>
              {troughs?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code}
                </option>
              ))}
            </select>
            <select className="input w-auto py-1.5 text-xs" value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity | '')}>
              <option value="">All severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
            <Segmented
              value={status}
              onChange={setStatus}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'acknowledged', label: 'Acknowledged' },
                { value: 'all', label: 'All' },
              ]}
            />
          </>
        }
      />

      <Card bodyClassName="p-0">
        {error ? (
          <div className="p-4">
            <ErrorState error={error} />
          </div>
        ) : !data ? (
          <Loading />
        ) : data.length === 0 ? (
          <EmptyState title="No alerts" hint="Nothing matches the current filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Severity</th>
                  <th>Trough</th>
                  <th>Sensor</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">
                      <p className="text-slate-200">{fmtDateTime(a.createdAt)}</p>
                      <p className="text-xs text-slate-500">{fmtAgo(a.createdAt)}</p>
                    </td>
                    <td>
                      <SeverityBadge severity={a.severity} />
                    </td>
                    <td>
                      <Link href={`/troughs/${a.troughId}`} className="text-tea-400 hover:text-tea-300">
                        {a.troughCode}
                      </Link>
                    </td>
                    <td className="text-slate-400">{a.sensorType ? SENSOR_META[a.sensorType].short : '—'}</td>
                    <td className="max-w-md text-slate-200">{a.message}</td>
                    <td className="text-xs text-slate-400">
                      {a.acknowledged ? (
                        <>
                          Ack by {a.acknowledgedBy?.name ?? '—'}
                          <br />
                          {a.acknowledgedAt && fmtAgo(a.acknowledgedAt)}
                        </>
                      ) : (
                        <span className="font-medium text-amber-300">Open</span>
                      )}
                    </td>
                    <td className="text-right">
                      {!a.acknowledged && canOperate(user) && (
                        <Button size="sm" variant="secondary" onClick={() => acknowledge(a)}>
                          <Check className="h-3 w-3" /> Acknowledge
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
