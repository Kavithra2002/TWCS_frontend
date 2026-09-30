'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { Plus } from 'lucide-react';
import { BatchActions } from '@/components/batches/BatchActions';
import { BatchFormModal } from '@/components/batches/BatchFormModal';
import { useAuth } from '@/components/providers/AuthProvider';
import { BatchStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { canOperate } from '@/lib/auth';
import { fmtDateTime, fmtDuration, fmtNumber } from '@/lib/format';
import type { Batch, BatchStatus, Trough } from '@/types';

type Filter = 'ALL' | BatchStatus;

export default function BatchesPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [modal, setModal] = useState(false);
  const key = `/batches${filter === 'ALL' ? '' : `?status=${filter}`}`;
  const { data, error, mutate } = useSWR<Batch[]>(key, { refreshInterval: 30_000 });
  const { data: troughs } = useSWR<Trough[]>('/troughs');

  return (
    <>
      <PageHeader
        title="Withering batches"
        description="Green leaf lots from intake to target moisture"
        actions={
          <>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'WITHERING', label: 'Withering' },
                { value: 'PLANNED', label: 'Planned' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'ABORTED', label: 'Aborted' },
              ]}
            />
            {canOperate(user) && (
              <Button onClick={() => setModal(true)}>
                <Plus className="h-4 w-4" /> New batch
              </Button>
            )}
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
          <EmptyState title="No batches" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Trough</th>
                  <th>Status</th>
                  <th className="text-right">Intake</th>
                  <th>Moisture (start → now / target)</th>
                  <th className="w-48">Progress</th>
                  <th>Duration</th>
                  <th>Started</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((b) => (
                  <tr key={b.id}>
                    <td className="font-medium text-slate-50">{b.code}</td>
                    <td>
                      <Link href={`/troughs/${b.troughId}`} className="text-tea-400 hover:text-tea-300">
                        {b.troughCode}
                      </Link>
                    </td>
                    <td>
                      <BatchStatusBadge status={b.status} />
                    </td>
                    <td className="text-right tabular-nums">{fmtNumber(b.leafIntakeKg, 0)} kg</td>
                    <td className="tabular-nums">
                      {fmtNumber(b.initialMoisture)}% → {fmtNumber(b.currentMoisture)}% / {fmtNumber(b.targetMoisture)}%
                    </td>
                    <td>
                      {b.progressPct != null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                            <div className="h-full rounded-full bg-tea-500" style={{ width: `${b.progressPct}%` }} />
                          </div>
                          <span className="w-9 text-right text-xs tabular-nums text-slate-400">{fmtNumber(b.progressPct, 0)}%</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="tabular-nums text-slate-400">{fmtDuration(b.elapsedMinutes)}</td>
                    <td className="whitespace-nowrap text-slate-400">{b.startedAt ? fmtDateTime(b.startedAt) : b.plannedStartAt ? `Planned ${fmtDateTime(b.plannedStartAt)}` : '—'}</td>
                    <td>
                      <BatchActions batch={b} onChanged={() => mutate()} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <BatchFormModal open={modal} onClose={() => setModal(false)} onSaved={() => mutate()} troughs={troughs ?? []} />
    </>
  );
}
