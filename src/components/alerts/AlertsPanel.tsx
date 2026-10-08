'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { Activity, Check, CheckCircle2, Leaf, Trash2, Wind } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { usePhaseAlerts } from '@/contexts/PhaseAlertContext';
import type { TroughPhase } from '@/contexts/SimulatorContext';
import { api, qs } from '@/lib/api';
import { canOperate } from '@/lib/auth';
import { fmtAgo, fmtDateTime } from '@/lib/format';
import { SENSOR_META } from '@/lib/sensors';
import type { Alert, AlertSeverity, Trough } from '@/types';

type Status = 'open' | 'acknowledged' | 'all';

// ── Sensor alerts table ───────────────────────────────────────────────────────

export function AlertsPanel() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('all');
  const [severity, setSeverity] = useState<AlertSeverity | ''>('');
  const [troughId, setTroughId] = useState('');
  const { data: troughs } = useSWR<Trough[]>('/troughs');
  const { data, error, mutate } = useSWR<Alert[]>(
    `/alerts${qs({ status, severity, troughId, limit: 200 })}`,
    { refreshInterval: 15_000, revalidateOnMount: true },
  );

  const acknowledge = async (a: Alert) => {
    await api(`/alerts/${a.id}/acknowledge`, { method: 'POST' });
    mutate();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input w-auto py-1.5 text-xs"
          value={troughId}
          onChange={(e) => setTroughId(e.target.value)}
        >
          <option value="">All troughs</option>
          {troughs?.map((t) => (
            <option key={t.id} value={t.id}>{t.code}</option>
          ))}
        </select>
        <select
          className="input w-auto py-1.5 text-xs"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as AlertSeverity | '')}
        >
          <option value="">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'acknowledged', label: 'Acknowledged' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {/* Sensor alerts */}
      <Card bodyClassName="p-0">
        {error ? (
          <div className="p-4"><ErrorState error={error} /></div>
        ) : !data ? (
          <Loading />
        ) : data.length === 0 ? (
          <EmptyState title="No alerts" hint="Nothing matches the current filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Severity</th>
                  <th>Trough</th>
                  <th>Sensor</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">
                      <p className="text-slate-200">{fmtDateTime(a.createdAt)}</p>
                      <p className="text-xs text-slate-500">{fmtAgo(a.createdAt)}</p>
                    </td>
                    <td><SeverityBadge severity={a.severity} /></td>
                    <td>
                      <Link href={`/troughs/${a.troughId}`} className="text-tea-400 hover:text-tea-300">
                        {a.troughCode}
                      </Link>
                    </td>
                    <td className="text-slate-400">
                      {a.sensorType ? SENSOR_META[a.sensorType].short : '—'}
                    </td>
                    <td className="max-w-md text-slate-200">{a.message}</td>
                    <td className="text-xs text-slate-400">
                      {a.acknowledged ? (
                        <>
                          Ack by {a.acknowledgedBy?.name ?? '—'}
                          <br />
                          {a.acknowledgedAt && fmtAgo(a.acknowledgedAt)}
                        </>
                      ) : (
                        <span className="font-medium text-amber-300">Open</span>
                      )}
                    </td>
                    <td className="text-right">
                      {!a.acknowledged && canOperate(user) && (
                        <Button size="sm" variant="secondary" onClick={() => acknowledge(a)}>
                          <Check className="h-3 w-3" /> Acknowledge
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Simulator phase events */}
      <SimulatorEventsCard />
    </div>
  );
}

// ── Simulator phase events ────────────────────────────────────────────────────

const PHASE_META: Record<TroughPhase, { label: string; color: string; Icon: React.ElementType }> = {
  SMR:  { label: 'SMR',  color: '#38bdf8', Icon: Leaf },
  IMR1: { label: 'IMR1', color: '#4ade80', Icon: Activity },
  LTO:  { label: 'LTO',  color: '#f59e0b', Icon: Wind },
  IMR2: { label: 'IMR2', color: '#2dd4bf', Icon: Activity },
  DONE: { label: 'Done', color: '#22c55e', Icon: CheckCircle2 },
};

const PHASE_DESC: Record<TroughPhase, string> = {
  SMR:  'Starting Moisture Reduction',
  IMR1: 'Initial Moisture Reduction 1',
  LTO:  'Lie-to-Off',
  IMR2: 'Initial Moisture Reduction 2',
  DONE: 'Session complete',
};

function SimulatorEventsCard() {
  const { log, clearLog } = usePhaseAlerts();
  const [filterTrough, setFilterTrough] = useState('');
  const [filterPhase, setFilterPhase] = useState<TroughPhase | ''>('');

  const troughNums = [...new Set(log.map((e) => e.troughNumber))].sort((a, b) => a - b);

  const filtered = log.filter((e) => {
    if (filterTrough && String(e.troughNumber) !== filterTrough) return false;
    if (filterPhase && e.phase !== filterPhase) return false;
    return true;
  });

  return (
    <Card
      title="Simulator Phase Events"
      subtitle="Phase transitions fired during this session"
      action={
        <div className="flex items-center gap-2">
          <select
            className="input w-auto py-1 text-xs"
            value={filterTrough}
            onChange={(e) => setFilterTrough(e.target.value)}
          >
            <option value="">All troughs</option>
            {troughNums.map((n) => (
              <option key={n} value={String(n)}>Trough {n}</option>
            ))}
          </select>
          <select
            className="input w-auto py-1 text-xs"
            value={filterPhase}
            onChange={(e) => setFilterPhase(e.target.value as TroughPhase | '')}
          >
            <option value="">All phases</option>
            {(Object.keys(PHASE_META) as TroughPhase[]).map((p) => (
              <option key={p} value={p}>{PHASE_META[p].label}</option>
            ))}
          </select>
          {log.length > 0 && (
            <button
              type="button"
              onClick={clearLog}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-400 transition hover:bg-slate-700"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      }
      bodyClassName="p-0"
    >
      {log.length === 0 ? (
        <EmptyState
          title="No phase events yet"
          hint="Start a trough in the Simulator — events appear here as phases transition"
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No events match the filter" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Time</th>
                <th>Trough</th>
                <th>Phase</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const meta = PHASE_META[e.phase];
                const { Icon } = meta;
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">
                      <p className="text-slate-200">{fmtDateTime(new Date(e.timestamp).toISOString())}</p>
                      <p className="text-xs text-slate-500">{fmtAgo(new Date(e.timestamp).toISOString())}</p>
                    </td>
                    <td>
                      <span className="font-semibold text-slate-200">Trough {e.troughNumber}</span>
                    </td>
                    <td>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{
                          color: meta.color,
                          backgroundColor: `${meta.color}1a`,
                          border: `1px solid ${meta.color}40`,
                        }}
                      >
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="text-slate-400">{PHASE_DESC[e.phase]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
