'use client';

import { useMemo, useState } from 'react';
import { TroughRingCard } from '@/components/troughs/TroughRingCard';
import { TroughDetailModal } from '@/components/troughs/TroughDetailModal';
import { TroughComparison } from '@/components/troughs/TroughComparison';
import { PageHeader } from '@/components/ui/PageHeader';
import { getPhase, useSimulator } from '@/contexts/SimulatorContext';
import { hasSimProgress, isLiveTroughId } from '@/lib/live-trough';

export default function TroughsPage() {
  const { state } = useSimulator();
  const [viewingId, setViewingId] = useState<string | null>(null);

  const troughList = Object.values(state.troughs);

  const stats = useMemo(() => {
    let running = 0;
    let paused = 0;
    let done = 0;
    let ready = 0;

    for (const t of troughList) {
      const live = isLiveTroughId(t.data.id);
      const started = live ? hasSimProgress(t) : t.running || t.idx > 0;
      const point = live ? t.livePoints[t.livePoints.length - 1] : t.data.timeSeries[t.idx] ?? t.data.timeSeries[0];
      const phase = !live && started
        ? getPhase(t.data.session, t.data.events, point?.timestamp ?? t.data.session.session_start)
        : null;

      if (t.running) running += 1;
      else if (phase === 'DONE') done += 1;
      else if (started) paused += 1;
      else ready += 1;
    }

    return { running, paused, done, ready, total: troughList.length };
  }, [troughList]);

  const viewingTrough = viewingId ? state.troughs[viewingId] : null;

  return (
    <>
      <PageHeader
        title="Withering troughs"
        description={
          state.loaded
            ? `${stats.total} troughs · live floor overview`
            : 'Loading simulator data…'
        }
        actions={
          state.loaded ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <StatChip label="Running" value={stats.running} tone="green" />
              <StatChip label="Paused" value={stats.paused} tone="amber" />
              <StatChip label="Ready" value={stats.ready} tone="slate" />
              <StatChip label="Done" value={stats.done} tone="slate" />
            </div>
          ) : undefined
        }
      />

      {!state.loaded ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-500">
          Loading…
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {troughList.map((t) => (
              <TroughRingCard
                key={t.data.id}
                troughState={t}
                onView={() => setViewingId(t.data.id)}
              />
            ))}
          </div>

          <TroughComparison troughs={troughList} />
        </>
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

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'green' | 'amber' | 'slate';
}) {
  const tones: Record<typeof tone, { color: string; bg: string; ring: string }> = {
    green: { color: '#15803d', bg: 'rgba(34,197,94,0.12)', ring: 'rgba(34,197,94,0.22)' },
    amber: { color: '#b45309', bg: 'rgba(245,158,11,0.12)', ring: 'rgba(245,158,11,0.22)' },
    slate: { color: '#475569', bg: 'rgba(15,23,42,0.05)',  ring: 'rgba(15,23,42,0.10)' },
  };
  const t = tones[tone];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{
        color: t.color,
        backgroundColor: t.bg,
        boxShadow: `inset 0 0 0 1px ${t.ring}`,
      }}
    >
      <span className="tabular-nums">{value}</span>
      <span className="font-medium opacity-70">{label}</span>
    </span>
  );
}
