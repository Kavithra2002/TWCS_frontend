'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import type { Trough } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  troughs: Trough[];
  defaultTroughId?: string;
}

export function BatchFormModal({ open, onClose, onSaved, troughs, defaultTroughId }: Props) {
  const [form, setForm] = useState({
    troughId: '',
    leafIntakeKg: '1500',
    initialMoisture: '78',
    targetMoisture: '62',
    plannedStartAt: '',
    notes: '',
    startNow: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setForm((f) => ({ ...f, troughId: defaultTroughId ?? troughs.find((t) => t.status === 'IDLE')?.id ?? troughs[0]?.id ?? '' }));
    }
  }, [open, troughs, defaultTroughId]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api('/batches', {
        method: 'POST',
        json: {
          troughId: form.troughId,
          leafIntakeKg: Number(form.leafIntakeKg),
          initialMoisture: Number(form.initialMoisture),
          targetMoisture: Number(form.targetMoisture),
          plannedStartAt: form.plannedStartAt ? new Date(form.plannedStartAt).toISOString() : undefined,
          notes: form.notes || undefined,
          startNow: form.startNow,
        },
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create batch');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New withering batch"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !form.troughId}>
            {saving ? 'Saving…' : form.startNow ? 'Create & start' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Trough</label>
          <select className="input" value={form.troughId} onChange={set('troughId')}>
            {troughs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name} ({t.status.toLowerCase()})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Green leaf intake (kg)</label>
          <input type="number" className="input" value={form.leafIntakeKg} onChange={set('leafIntakeKg')} />
        </div>
        <div>
          <label className="label">Planned start</label>
          <input type="datetime-local" className="input" value={form.plannedStartAt} onChange={set('plannedStartAt')} />
        </div>
        <div>
          <label className="label">Initial moisture (%)</label>
          <input type="number" step="0.1" className="input" value={form.initialMoisture} onChange={set('initialMoisture')} />
        </div>
        <div>
          <label className="label">Target moisture (%)</label>
          <input type="number" step="0.1" className="input" value={form.targetMoisture} onChange={set('targetMoisture')} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input min-h-[70px]" value={form.notes} onChange={set('notes')} placeholder="Estate, leaf grade, weather…" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
          <input type="checkbox" checked={form.startNow} onChange={(e) => setForm({ ...form, startNow: e.target.checked })} className="accent-tea-500" />
          Start withering immediately
        </label>
      </div>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </Modal>
  );
}
