'use client';

import clsx from 'clsx';
import { CalendarClock, Clock, Gauge, Layers, Type } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { controlClass, Field, FormAlert, ToggleRow } from '@/components/ui/Field';
import { Modal, ModalIcon } from '@/components/ui/Modal';
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
      description="Choose the trough, action, and when it runs."
      icon={<ModalIcon icon={CalendarClock} />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !form.name || !form.troughId || form.daysOfWeek.length === 0}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Trough" icon={Layers} chevron>
          <select
            className={controlClass({ icon: true, chevron: true })}
            value={form.troughId}
            disabled={!!schedule}
            onChange={(e) => setForm({ ...form, troughId: e.target.value })}
          >
            {troughs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Action" icon={Gauge} chevron>
          <select
            className={controlClass({ icon: true, chevron: true })}
            value={form.action}
            onChange={(e) => setForm({ ...form, action: e.target.value as ScheduleAction })}
          >
            {Object.entries(SCHEDULE_ACTION_STYLE).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name" icon={Type} className="sm:col-span-2">
          <input
            className={controlClass({ icon: true })}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Morning wither"
          />
        </Field>
        <Field label="Start" icon={Clock}>
          <input type="time" className={controlClass({ icon: true })} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        </Field>
        <Field label="End" icon={Clock}>
          <input type="time" className={controlClass({ icon: true })} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-medium text-slate-300">Days</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_SHORT.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={form.daysOfWeek.includes(i)}
                onClick={() => toggleDay(i)}
                className={clsx(
                  'rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition',
                  form.daysOfWeek.includes(i) ? 'bg-tea-600/20 text-tea-200 ring-tea-500' : 'text-slate-400 ring-slate-700 hover:ring-slate-500',
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <Field label="Setpoint (optional)" icon={Gauge}>
          <input
            type="number"
            step="0.1"
            className={controlClass({ icon: true })}
            value={form.setpoint}
            onChange={(e) => setForm({ ...form, setpoint: e.target.value })}
            placeholder="e.g. 32 °C"
          />
        </Field>
        <div className="flex items-end">
          <ToggleRow checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })} label="Enabled" />
        </div>
      </div>
      {error && <div className="mt-3.5"><FormAlert>{error}</FormAlert></div>}
    </Modal>
  );
}
