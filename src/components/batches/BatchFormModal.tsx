'use client';

import { Clock, Droplets, Layers, Leaf, NotebookPen, Scale, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { controlClass, Field, FormAlert, ToggleRow } from '@/components/ui/Field';
import { Modal, ModalIcon } from '@/components/ui/Modal';
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
      description="Record green leaf and start a withering run."
      icon={<ModalIcon icon={Leaf} />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !form.troughId}>
            {saving ? 'Saving…' : form.startNow ? 'Create & start' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Trough" icon={Layers} chevron className="sm:col-span-2">
          <select className={controlClass({ icon: true, chevron: true })} value={form.troughId} onChange={set('troughId')}>
            {troughs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name} ({t.status.toLowerCase()})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Green leaf intake (kg)" icon={Scale}>
          <input type="number" className={controlClass({ icon: true })} value={form.leafIntakeKg} onChange={set('leafIntakeKg')} />
        </Field>
        <Field label="Planned start" icon={Clock}>
          <input type="datetime-local" className={controlClass({ icon: true })} value={form.plannedStartAt} onChange={set('plannedStartAt')} />
        </Field>
        <Field label="Initial moisture (%)" icon={Droplets}>
          <input type="number" step="0.1" className={controlClass({ icon: true })} value={form.initialMoisture} onChange={set('initialMoisture')} />
        </Field>
        <Field label="Target moisture (%)" icon={Target}>
          <input type="number" step="0.1" className={controlClass({ icon: true })} value={form.targetMoisture} onChange={set('targetMoisture')} />
        </Field>
        <Field label="Notes" icon={NotebookPen} iconAlign="top" className="sm:col-span-2">
          <textarea className={controlClass({ icon: true, area: true })} value={form.notes} onChange={set('notes')} placeholder="Estate, leaf grade, weather…" />
        </Field>
        <div className="sm:col-span-2">
          <ToggleRow checked={form.startNow} onChange={(startNow) => setForm({ ...form, startNow })} label="Start withering immediately" />
        </div>
      </div>
      {error && <div className="mt-3.5"><FormAlert>{error}</FormAlert></div>}
    </Modal>
  );
}
