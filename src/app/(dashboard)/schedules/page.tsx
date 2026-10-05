'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { ScheduleFormModal } from '@/components/schedules/ScheduleFormModal';
import { ScheduleTimeline } from '@/components/schedules/ScheduleTimeline';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { api } from '@/lib/api';
import { canPlan } from '@/lib/auth';
import { toMinutes, WEEKDAY_SHORT } from '@/lib/format';
import { SCHEDULE_ACTION_STYLE } from '@/lib/sensors';
import type { Schedule, TodaySchedules, Trough } from '@/types';

export default function SchedulesPage() {
  const { user } = useAuth();
  const { data: schedules, error, mutate } = useSWR<Schedule[]>('/schedules');
  const { data: troughs } = useSWR<Trough[]>('/troughs');
  const { data: today } = useSWR<TodaySchedules>('/schedules/today', { refreshInterval: 60_000 });
  const [day, setDay] = useState<number | null>(null);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [modal, setModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Schedule | null>(null);

  const selectedDay = day ?? today?.weekday ?? new Date().getDay();
  const isToday = today && selectedDay === today.weekday;
  const editable = canPlan(user);

  const toggle = async (s: Schedule) => {
    await api(`/schedules/${s.id}`, { method: 'PATCH', json: { enabled: !s.enabled } });
    mutate();
  };

  const remove = async (s: Schedule) => {
    await api(`/schedules/${s.id}`, { method: 'DELETE' });
    mutate();
  };

  if (error) return <ErrorState error={error} />;

  return (
    <>
      <PageHeader
        title="Schedules"
        description={today ? `Weekly operating plan · factory time ${today.now} (${today.timeZone})` : 'Weekly operating plan'}
        actions={
          editable && (
            <Button
              onClick={() => {
                setEditing(null);
                setModal(true);
              }}
            >
              <Plus className="h-4 w-4" /> New schedule
            </Button>
          )
        }
      />

      <Card
        title={`Timeline · ${WEEKDAY_SHORT[selectedDay]}${isToday ? ' (today)' : ''}`}
        action={
          <Segmented
            value={String(selectedDay)}
            onChange={(v) => setDay(Number(v))}
            options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: WEEKDAY_SHORT[d] }))}
          />
        }
      >
        {!schedules || !troughs ? (
          <Loading />
        ) : (
          <ScheduleTimeline
            nowMinutes={isToday && today ? toMinutes(today.now) : undefined}
            rows={troughs.map((t) => ({
              id: t.id,
              label: t.code,
              items: schedules.filter((s) => s.troughId === t.id && s.daysOfWeek.includes(selectedDay)),
            }))}
          />
        )}
      </Card>

      <Card title="All schedules" className="mt-4" bodyClassName="p-0">
        {!schedules ? (
          <Loading />
        ) : schedules.length === 0 ? (
          <EmptyState title="No schedules" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Trough</th>
                  <th>Name</th>
                  <th>Action</th>
                  <th>Time</th>
                  <th>Days</th>
                  <th>Setpoint</th>
                  <th>Enabled</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className={s.enabled ? '' : 'opacity-50'}>
                    <td className="font-medium text-slate-50">{s.troughCode}</td>
                    <td>{s.name}</td>
                    <td>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SCHEDULE_ACTION_STYLE[s.action].color }} />
                        {SCHEDULE_ACTION_STYLE[s.action].label}
                      </span>
                    </td>
                    <td className="tabular-nums">
                      {s.startTime}–{s.endTime}
                    </td>
                    <td className="text-xs text-slate-400">{[1, 2, 3, 4, 5, 6, 0].filter((d) => s.daysOfWeek.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(' ')}</td>
                    <td className="tabular-nums">{s.setpoint ?? '—'}</td>
                    <td>
                      <input type="checkbox" checked={s.enabled} disabled={!editable} onChange={() => toggle(s)} className="accent-tea-500" />
                    </td>
                    <td>
                      {editable && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(s);
                              setModal(true);
                            }}
                            aria-label="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setPendingDelete(s)} aria-label="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ScheduleFormModal open={modal} onClose={() => setModal(false)} onSaved={() => mutate()} troughs={troughs ?? []} schedule={editing} />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete schedule"
        description={pendingDelete ? `"${pendingDelete.name}" for ${pendingDelete.troughCode} will be removed.` : ''}
        confirmLabel="Delete schedule"
        danger
        onConfirm={() => (pendingDelete ? remove(pendingDelete) : Promise.resolve())}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
