'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { WEEKDAY_SHORT } from '@/lib/format';
import { SCHEDULE_ACTION_STYLE } from '@/lib/sensors';
import type { Schedule, ScheduleAction, Trough } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  troughs: Trough[];
  schedule?: Schedule | null;
}

const EMPTY = {
  troughId: '',
  name: '',
  action: 'WITHERING_CYCLE' as ScheduleAction,
  startTime: '06:00',
  endTime: '14:00',
  daysOfWeek: [1, 2, 3, 4, 5, 6],
  setpoint: '',
  enabled: true,
};

export function ScheduleFormModal({ open, onClose, onSaved, troughs, schedule }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      schedule
        ? {
            troughId: schedule.troughId,
            name: schedule.name,
            action: schedule.action,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            daysOfWeek: schedule.daysOfWeek,
            setpoint: schedule.setpoint?.toString() ?? '',
            enabled: schedule.enabled,
          }
        : { ...EMPTY, troughId: troughs[0]?.id ?? '' },
    );
  }, [open, schedule, troughs]);

  const toggleDay = (d: number) =>
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter((x) => x !== d) : [...f.daysOfWeek, d].sort(),
    }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      action: form.action,
      startTime: form.startTime,
      endTime: form.endTime,
      daysOfWeek: form.daysOfWeek,
      setpoint: form.setpoint === '' ? null : Number(form.setpoint),
      enabled: form.enabled,
    };
    try {
      if (schedule) await api(`/schedules/${schedule.id}`, { method: 'PATCH', json: payload });
      else await api('/schedules', { method: 'POST', json: { ...payload, troughId: form.troughId } });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={schedule ? 'Edit schedule' : 'New schedule'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !form.name || !form.troughId || form.daysOfWeek.length === 0}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Trough</label>
          <select className="input" value={form.troughId} disabled={!!schedule} onChange={(e) => setForm({ ...form, troughId: e.target.value })}>
            {troughs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Action</label>
          <select className="input" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as ScheduleAction })}>
            {Object.entries(SCHEDULE_ACTION_STYLE).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Morning wither" />
        </div>
        <div>
          <label className="label">Start</label>
          <input type="time" className="input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        </div>
        <div>
          <label className="label">End</label>
          <input type="time" className="input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Days</label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_SHORT.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(i)}
                className={clsx(
                  'rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                  form.daysOfWeek.includes(i) ? 'bg-tea-600/25 text-tea-200 ring-tea-500/50' : 'text-slate-400 ring-slate-700',
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Setpoint (optional)</label>
          <input type="number" step="0.1" className="input" value={form.setpoint} onChange={(e) => setForm({ ...form, setpoint: e.target.value })} placeholder="e.g. 32 °C" />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="accent-tea-500" />
          Enabled
        </label>
      </div>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </Modal>
  );
}
