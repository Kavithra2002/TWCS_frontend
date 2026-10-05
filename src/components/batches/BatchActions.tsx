'use client';

import { Play, Square, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { api } from '@/lib/api';
import { canOperate } from '@/lib/auth';
import type { Batch } from '@/types';

/** Start / complete / abort controls for a batch, depending on its status. */
export function BatchActions({ batch, onChanged }: { batch: Batch; onChanged: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<{ title: string; description: string; confirmLabel: string; danger?: boolean; path?: string; body?: unknown } | null>(null);
  if (!canOperate(user)) return null;

  const run = async (path: string, body: unknown) => {
    setBusy(true);
    try {
      await api(`/batches/${batch.id}/${path}`, { method: 'POST', json: body });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    void run('start', {}).catch((error) =>
      setPrompt({
        title: 'Action failed',
        description: error instanceof Error ? error.message : 'Action failed',
        confirmLabel: 'Close',
      }),
    );
  };

  return (
    <div className="flex gap-1.5">
      {batch.status === 'PLANNED' && (
        <Button size="sm" onClick={start} disabled={busy}>
          <Play className="h-3 w-3" /> Start
        </Button>
      )}
      {batch.status === 'WITHERING' && (
        <Button
          size="sm"
          onClick={() =>
            setPrompt({
              title: 'Complete batch',
              description: `Complete ${batch.code}? Final moisture will use the latest reading.`,
              confirmLabel: 'Complete',
              path: 'complete',
              body: {},
            })
          }
          disabled={busy}
        >
          <Square className="h-3 w-3" /> Complete
        </Button>
      )}
      {(batch.status === 'PLANNED' || batch.status === 'WITHERING') && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setPrompt({
              title: 'Abort batch',
              description: `Abort ${batch.code}? This stops the withering run.`,
              confirmLabel: 'Abort batch',
              danger: true,
              path: 'abort',
              body: {},
            })
          }
          disabled={busy}
        >
          <XCircle className="h-3 w-3" /> Abort
        </Button>
      )}
      <ConfirmDialog
        open={prompt !== null}
        title={prompt?.title ?? ''}
        description={prompt?.description ?? ''}
        confirmLabel={prompt?.confirmLabel ?? 'Confirm'}
        danger={prompt?.danger}
        onConfirm={() => (prompt?.path ? run(prompt.path, prompt.body) : Promise.resolve())}
        onClose={() => setPrompt(null)}
      />
    </div>
  );
}
