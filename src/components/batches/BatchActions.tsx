'use client';

import { Play, Square, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { canOperate } from '@/lib/auth';
import type { Batch } from '@/types';

/** Start / complete / abort controls for a batch, depending on its status. */
export function BatchActions({ batch, onChanged }: { batch: Batch; onChanged: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!canOperate(user)) return null;

  const run = async (path: string, body: unknown, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await api(`/batches/${batch.id}/${path}`, { method: 'POST', json: body });
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-1.5">
      {batch.status === 'PLANNED' && (
        <Button size="sm" onClick={() => run('start', {})} disabled={busy}>
          <Play className="h-3 w-3" /> Start
        </Button>
      )}
      {batch.status === 'WITHERING' && (
        <Button size="sm" onClick={() => run('complete', {}, `Complete batch ${batch.code}? Final moisture will use the latest reading.`)} disabled={busy}>
          <Square className="h-3 w-3" /> Complete
        </Button>
      )}
      {(batch.status === 'PLANNED' || batch.status === 'WITHERING') && (
        <Button size="sm" variant="secondary" onClick={() => run('abort', {}, `Abort batch ${batch.code}?`)} disabled={busy}>
          <XCircle className="h-3 w-3" /> Abort
        </Button>
      )}
    </div>
  );
}
