'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { TroughCard } from '@/components/troughs/TroughCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { SENSOR_ORDER } from '@/lib/sensors';
import type { Batch, TroughStatus, TroughWithLive } from '@/types';

type Filter = 'ALL' | TroughStatus;

export default function TroughsPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const { data, error } = useSWR<TroughWithLive[]>('/troughs', { refreshInterval: 60_000 });
  const { data: active } = useSWR<Batch[]>('/batches?status=WITHERING');

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;

  const troughs = filter === 'ALL' ? data : data.filter((t) => t.status === filter);

  return (
    <>
      <PageHeader
        title="Withering troughs"
        description={`${data.length} troughs · ${data.filter((t) => t.status === 'RUNNING').length} running`}
        actions={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'RUNNING', label: 'Running' },
              { value: 'IDLE', label: 'Idle' },
              { value: 'MAINTENANCE', label: 'Maintenance' },
              { value: 'OFFLINE', label: 'Offline' },
            ]}
          />
        }
      />
      {troughs.length === 0 ? (
        <EmptyState title="No troughs match this filter" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {troughs.map((t) => (
            <TroughCard
              key={t.id}
              trough={t}
              sensorTypes={SENSOR_ORDER.filter((s) => s !== 'LEAF_WEIGHT')}
              activeBatch={active?.find((b) => b.troughId === t.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
