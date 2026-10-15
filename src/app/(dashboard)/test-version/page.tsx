'use client';

import { Database, Pause, Play, Radio, RefreshCw, RotateCcw, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ApiError, api } from '@/lib/api';
import type { TestVersionStatus, TestVersionTrough } from '@/types';

const loadStatus = () => api<TestVersionStatus>('/test-version/status', { live: true });
const loadTroughs = () => api<TestVersionTrough[]>('/test-version/troughs', { live: true });

/** Full time_series.json column set (+ DB inserted_at). */
const TS_FIELDS = [
  'sample_id',
  'withering_id',
  'timestamp',
  'ambient_rh_pct',
  'ambient_temp_c',
  'inlet_rh_pct',
  'inlet_temp_c',
  'upper_rh_pct',
  'upper_temp_c',
  'lower_rh_pct',
  'lower_temp_c',
  'chamber_pressure_pa',
  'pressure_demand_pa',
  'fan_speed_hz',
  'hot_louver_position_pct',
  'hot_louver_demand_pct',
  'amb_louver_position_pct',
  'amb_louver_demand_pct',
  'cumulative_energy_kwh',
  'current_ws_pct',
  'weight_kg',
] as const;

const DB_FIELDS = [...TS_FIELDS, 'inserted_at'] as const;

export default function TestVersionPage() {
  const { data: status, error, mutate, isLoading } = useSWR('test-version-status', loadStatus, {
    refreshInterval: 1500,
  });
  const { data: troughs } = useSWR('test-version-troughs', loadTroughs);
  const [troughId, setTroughId] = useState('t01');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (status?.troughId) setTroughId(status.troughId);
  }, [status?.troughId]);

  async function start() {
    setBusy(true);
    setActionError('');
    try {
      await api('/test-version/start', { method: 'POST', json: { troughId }, live: true });
      await mutate();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not start publisher');
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    setActionError('');
    try {
      await api('/test-version/stop', { method: 'POST', live: true });
      await mutate();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not stop publisher');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setActionError('');
    try {
      const next = await api<TestVersionStatus>('/test-version/reset', { method: 'POST', live: true });
      await mutate(next, { revalidate: false });
      setTroughId('t01');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not reset — is the SSH tunnel open?');
      // Still re-fetch so publisher counters show 0 even if DB truncate failed
      await mutate();
    } finally {
      setBusy(false);
    }
  }

  const lastTs =
    status?.lastSent?.kind === 'timeseries'
      ? (status.lastSent.payload as Record<string, unknown>)
      : status?.recentSent?.[0]?.payload
        ? (status.recentSent[0].payload as Record<string, unknown>)
        : null;

  const dbRows = status?.db?.timeSeries ?? [];
  const progress =
    status && status.sampleTotal > 0
      ? Math.min(100, Math.round(((status.sampleIndex % Math.max(status.sampleTotal, 1)) / status.sampleTotal) * 100))
      : 0;

  return (
    <div>
      <PageHeader
        title="Test Version"
        description="Publish moc_json → DigitalOcean MQTT (withering/*). Live panel shows each 10s send and Postgres rows via SSH tunnel."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={troughId}
              disabled={busy || status?.running}
              onChange={(e) => setTroughId(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              {(troughs ?? [{ id: 't01', available: true }]).map((t) => (
                <option key={t.id} value={t.id} disabled={!t.available}>
                  {t.id.toUpperCase()}
                </option>
              ))}
            </select>
            {status?.running ? (
              <Button variant="danger" onClick={stop} disabled={busy}>
                <Pause className="h-3.5 w-3.5" />
                Stop
              </Button>
            ) : (
              <Button onClick={start} disabled={busy || isLoading}>
                <Play className="h-3.5 w-3.5" />
                Start publish
              </Button>
            )}
            <Button
              variant="danger"
              onClick={reset}
              disabled={busy}
              title="Stop publish, set counts to 0, clear droplet sessions/events/time_series"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button variant="secondary" onClick={() => mutate()} disabled={busy}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {(actionError || error) && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {actionError || (error instanceof Error ? error.message : 'Failed to load status')}
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="MQTT broker"
          value={status?.brokerUrl ?? '—'}
          hint={status?.connected ? 'Connected' : 'Disconnected'}
          ok={status?.connected}
        />
        <Stat
          label="Topics"
          value={
            status
              ? `${status.topics.session} · ${status.topics.events} · ${status.topics.timeseries}`
              : '—'
          }
          hint={`Every ${status?.intervalMs ?? 10000} ms · QoS 1`}
        />
        <Stat
          label="Published samples"
          value={status ? String(status.sampleIndex) : '—'}
          hint={status?.witheringId ?? 'No run'}
        />
        <Stat
          label="DB rows (tunnel)"
          value={
            status?.db
              ? `${status.db.counts.time_series} ts · ${status.db.counts.events} ev · ${status.db.counts.sessions} sess`
              : '—'
          }
          hint={
            status?.db?.ok
              ? `Polled ${status.db.polledAt ? new Date(status.db.polledAt).toLocaleTimeString() : '—'}`
              : status?.db?.error ?? status?.tunnelHint ?? 'Open SSH tunnel'
          }
          ok={status?.db?.ok}
        />
      </div>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-tea-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {!status?.db?.ok && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          Keep this tunnel open in a terminal so the viewer can read droplet Postgres:
          <code className="mt-1 block rounded bg-black/30 px-2 py-1 font-mono text-xs text-amber-50">
            {status?.tunnelHint ?? 'ssh -L 15432:127.0.0.1:5432 root@168.144.35.189'}
          </code>
        </div>
      )}

      {/* Latest outbound sample — all time_series fields */}
      <section className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/70">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-200">
          <Send className="h-4 w-4 text-orange-400" />
          Sending every 10s (MQTT out) — full variable list
        </div>
        <div className="p-4">
          {lastTs ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {TS_FIELDS.map((key) => (
                <Metric
                  key={key}
                  label={key}
                  value={cellValue(lastTs[key], key)}
                  mono={key === 'sample_id' || key === 'withering_id' || key === 'timestamp'}
                />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">Start a run to see each outbound sample.</p>
          )}
        </div>
      </section>

      {/* DB mirror — all columns */}
      <section className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/70">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-200">
          <span className="flex items-center gap-2">
            <Database className="h-4 w-4 text-sky-400" />
            DigitalOcean DB (poll every 10s) — full time_series columns
          </span>
          <span className="text-[11px] font-normal text-slate-500">Scroll horizontally for all fields</span>
        </div>
        <div className="max-h-[480px] overflow-auto p-2">
          {!status?.db?.ok && (
            <p className="px-2 py-6 text-center text-sm text-slate-500">
              {status?.db?.error ?? 'DB not reachable yet — start tunnel, then Start publish.'}
            </p>
          )}
          {status?.db?.ok && dbRows.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-slate-500">
              Connected — waiting for rows (check vbox-subscriber on the droplet).
            </p>
          )}
          {dbRows.length > 0 && (
            <table className="min-w-max text-left text-[11px] text-slate-300">
              <thead className="sticky top-0 z-10 bg-slate-900 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  {DB_FIELDS.map((key) => (
                    <th key={key} className="whitespace-nowrap px-2 py-2 font-medium">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dbRows.slice(0, 100).map((row) => (
                  <tr key={String(row.sample_id)} className="border-t border-slate-800/80 hover:bg-slate-800/40">
                    {DB_FIELDS.map((key) => (
                      <td
                        key={key}
                        className={`whitespace-nowrap px-2 py-1.5 ${
                          key === 'sample_id' || key === 'withering_id' ? 'font-mono text-sky-400' : 'font-mono'
                        }`}
                      >
                        {cellValue(row[key], key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-200">
          <Radio className="h-4 w-4 text-tea-400" />
          Publish log
        </div>
        <div className="max-h-[280px] overflow-y-auto px-2 py-2 font-mono text-[12px] leading-relaxed text-slate-300">
          {!status?.log.length && (
            <p className="px-2 py-6 text-center text-slate-500">
              Start → session object + events array + first timeseries, then one sample every 10s (fresh UUID each time).
            </p>
          )}
          {status?.log.map((entry, i) => (
            <div
              key={`${entry.at}-${i}`}
              className={`flex flex-wrap gap-x-3 gap-y-0.5 rounded-lg px-2 py-1.5 ${
                entry.ok ? 'hover:bg-slate-800/60' : 'bg-red-950/30 text-red-200'
              }`}
            >
              <span className="text-slate-500">{new Date(entry.at).toLocaleTimeString()}</span>
              <span className={entry.ok ? 'text-tea-400' : 'text-red-300'}>{entry.kind}</span>
              <span className="truncate text-slate-400">{entry.topic}</span>
              {entry.sampleId && <span className="text-sky-400">{entry.sampleId.slice(0, 8)}…</span>}
              {entry.index != null && (
                <span className="text-slate-500">
                  #{entry.index}
                  {entry.total != null ? `/${entry.total}` : ''}
                </span>
              )}
              {!entry.ok && entry.error && <span className="text-red-300">{entry.error}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  ok,
}: {
  label: string;
  value: string;
  hint?: string;
  ok?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-100" title={value}>
        {value}
      </div>
      {hint && (
        <div className={`mt-1 truncate text-xs ${ok ? 'text-tea-400' : 'text-slate-500'}`} title={hint}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-black/25 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 truncate text-slate-100 ${mono ? 'font-mono text-[11px]' : 'text-sm font-semibold'}`}>
        {value}
      </div>
    </div>
  );
}

function fmt(v: unknown) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : String(v);
}

function cellValue(v: unknown, key: string) {
  if (v == null || v === '') return '—';
  if (key === 'timestamp' || key === 'inserted_at') {
    const d = new Date(String(v));
    if (!Number.isNaN(d.getTime())) {
      return key === 'inserted_at' ? d.toLocaleString() : String(v).replace('T', ' ').slice(0, 19);
    }
  }
  if (key === 'sample_id' || key === 'withering_id') return String(v);
  return fmt(v);
}
