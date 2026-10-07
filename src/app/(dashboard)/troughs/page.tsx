'use client';

import { useState } from 'react';
import { TroughRingCard } from '@/components/troughs/TroughRingCard';
import { TroughDetailModal } from '@/components/troughs/TroughDetailModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSimulator } from '@/contexts/SimulatorContext';

export default function TroughsPage() {
  const { state } = useSimulator();
  const [viewingId, setViewingId] = useState<string | null>(null);

  const troughList = Object.values(state.troughs);
  const running = troughList.filter((t) => t.running).length;

  const viewingTrough = viewingId ? state.troughs[viewingId] : null;

  return (
    <>
      <PageHeader
        title="Withering troughs"
        description={
          state.loaded
            ? `${troughList.length} troughs · ${running} running`
            : 'Loading simulator data…'
        }
      />

      {!state.loaded ? (
        <div className="flex h-40 items-center justify-center text-slate-500 text-sm">
          Loading…
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {troughList.map((t) => (
            <TroughRingCard
              key={t.data.id}
              troughState={t}
              onView={() => setViewingId(t.data.id)}
            />
          ))}
        </div>
      )}

      {viewingTrough && (
        <TroughDetailModal
          troughState={viewingTrough}
          onClose={() => setViewingId(null)}
        />
      )}
    </>
  );
}
