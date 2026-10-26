'use client';

import { Activity, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { VnetLiveBoard } from '@/components/charts/VnetLiveBoard';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { api } from '@/lib/api';
import type { RawLiveFeed, RawVboxRow, TestVersionStatus } from '@/types';

const loadStatus = () => api<TestVersionStatus>('/test-version/status', { live: true });

const TABLE_FIELDS = [
  'timestamp',
  'current_ws_pct',
  'weight_kg',
  'ambient_temp_c',
  'ambient_rh_pct',
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
  'withering_id',
  'sample_id',
] as const;

const PRIMARY = [
  { key: 'current_ws_pct', label: 'Wither', unit: '%', digits: 2 },
  { key: 'weight_kg', label: 'Weight', unit: 'kg', digits: 1 },
  { key: 'ambient_temp_c', label: 'Ambient', unit: '°C', digits: 1 },
  { key: 'ambient_rh_pct', label: 'Humidity', unit: '%', digits: 1 },
] as const;

const SECONDARY = [
  { key: 'inlet_temp_c', label: 'Inlet temp', unit: '°C', digits: 1 },
  { key: 'inlet_rh_pct', label: 'Inlet RH', unit: '%', digits: 1 },
  { key: 'upper_temp_c', label: 'Upper temp', unit: '°C', digits: 1 },
  { key: 'upper_rh_pct', label: 'Upper RH', unit: '%', digits: 1 },
  { key: 'lower_temp_c', label: 'Lower temp', unit: '°C', digits: 1 },
  { key: 'lower_rh_pct', label: 'Lower RH', unit: '%', digits: 1 },
  { key: 'fan_speed_hz', label: 'Fan', unit: 'Hz', digits: 1 },
  { key: 'chamber_pressure_pa', label: 'Pressure', unit: 'Pa', digits: 1 },
  { key: 'pressure_demand_pa', label: 'Press. demand', unit: 'Pa', digits: 1 },
  { key: 'hot_louver_position_pct', label: 'Hot louver', unit: '%', digits: 0 },
  { key: 'hot_louver_demand_pct', label: 'Hot demand', unit: '%', digits: 0 },
  { key: 'amb_louver_position_pct', label: 'Amb louver', unit: '%', digits: 0 },
  { key: 'amb_louver_demand_pct', label: 'Amb demand', unit: '%', digits: 0 },
  { key: 'cumulative_energy_kwh', label: 'Energy', unit: 'kWh', digits: 3 },
] as const;

const READINGS = [...PRIMARY, ...SECONDARY];

export default function TestVersionPage() {
  const { data: status, error, mutate } = useSWR('test-version-status', loadStatus, {
    refreshInterval: 1500,
  });

  const connected = Boolean(status?.live?.dbConnected && status.live.feedConnected);
  const dbDown = status?.live?.dbConnected === false;

  return (
    <div>
      <PageHeader
        title="Test Version"
        description="Live view of VNet samples in raw_vbox_data. Charts follow the same rows as the table."
        actions={
          <Button variant="secondary" onClick={() => mutate()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error instanceof Error ? error.message : 'Failed to load the live feed'}
        </div>
      )}

      <LiveFeed live={status?.live} tunnelHint={status?.tunnelHint} />

      <div
        className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
          connected
            ? 'border-green-500/25 bg-green-500/10'
            : dbDown
              ? 'border-red-500/25 bg-red-500/10'
              : 'border-amber-500/20 bg-amber-500/10'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'animate-pulse bg-green-400' : dbDown ? 'bg-red-400' : 'bg-amber-400'}`} />
          <div>
            <p className="text-sm font-semibold text-slate-100">
              {connected ? 'VNet feed live' : dbDown ? 'Database unreachable' : 'Waiting for samples'}
            </p>
            <p className="text-[11px] text-slate-500">
              {dbDown
                ? status?.live?.error ?? 'Open the SSH tunnel to read raw_vbox_data.'
                : status?.live?.feedConnected
                  ? `Last sample ${formatAge(status.live.ageMs)} · ${status.live.count.toLocaleString()} rows in the table`
                  : status?.live?.lastReceivedAt
                    ? `No sample for ${formatAge(status.live.ageMs)} · ${status.live.count.toLocaleString()} rows stored`
                    : 'The charts fill as soon as the first row arrives.'}
            </p>
          </div>
        </div>
        <StatusPill ok={connected} label={connected ? 'Connected' : 'Disconnected'} />
      </div>

      <VnetLiveBoard rows={status?.live?.rows ?? []} />
    </div>
  );
}

function LiveFeed({ live, tunnelHint }: { live?: RawLiveFeed; tunnelHint?: string }) {
  const [view, setView] = useState<'samples' | 'table'>('samples');
  const connected = Boolean(live?.dbConnected && live.feedConnected);
  const dbDown = live?.dbConnected === false;
  const age = formatAge(live?.ageMs);
  const newestId = live?.rows[0]?.id;
  const justArrivedId = useJustArrived(newestId);
  const flashKeys = useFieldFlash(live?.rows);

  return (
    <section className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/70">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <Activity className="h-4 w-4 text-tea-400" />
            {view === 'samples' ? 'Incoming samples' : 'VNet live data — raw_vbox_data'}
          </div>
          <Segmented
            value={view}
            options={[
              { value: 'samples', label: 'Samples' },
              { value: 'table', label: 'Table' },
            ]}
            onChange={setView}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusPill ok={connected} label={connected ? 'Connected' : 'Disconnected'} />
          <span className="text-slate-500">
            {dbDown
              ? 'Database unreachable'
              : live?.feedConnected
                ? `Newest row ${age}`
                : live?.lastReceivedAt
                  ? `No new row for ${age}`
                  : 'Waiting for the first row'}
          </span>
          <span className="text-slate-500">{live ? `${live.count.toLocaleString()} stored` : ''}</span>
        </div>
      </div>

      {dbDown && (
        <div className="border-b border-red-500/20 bg-red-950/30 px-4 py-2 text-sm text-red-100">
          Disconnected — {live?.error ?? 'open the SSH tunnel so this page can read the droplet database.'}
          <code className="mt-1 block rounded bg-black/30 px-2 py-1 font-mono text-xs text-red-50">
            {tunnelHint ?? 'ssh -L 15432:127.0.0.1:5432 root@168.144.35.189'}
          </code>
        </div>
      )}

      {!dbDown && live && !live.feedConnected && (
        <div className="border-b border-amber-500/20 bg-amber-950/30 px-4 py-2 text-sm text-amber-100">
          The database is reachable, but no new row has arrived in the last 25 seconds.
        </div>
      )}

      {view === 'table' ? (
        <RawTable live={live} justArrivedId={justArrivedId} />
      ) : (
        <div className="p-3">
          {!live?.rows.length && (
            <p className="px-2 py-8 text-center text-sm text-slate-500">
              {dbDown ? 'Rows show up here once the database connects.' : 'Waiting for the next VNet row.'}
            </p>
          )}

          {!!live?.rows.length && (
            <div className="space-y-2">
              <SampleCard
                row={live.rows[0]}
                older={live.rows[1]}
                index={0}
                justArrived={justArrivedId === live.rows[0].id}
                flashKeys={flashKeys}
              />
              {live.rows.length > 1 && (
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {live.rows.slice(1).map((row, index) => (
                    <SampleCard
                      key={row.id}
                      row={row}
                      older={live.rows[index + 2]}
                      index={index + 1}
                      justArrived={false}
                      flashKeys={null}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'samples' && !!live?.statusLog.length && (
        <div className="border-t border-slate-800 px-4 py-2 text-[11px] text-slate-500">
          {live.statusLog[0].state === 'connected' ? 'Connected' : 'Disconnected'}
          {' · '}
          {live.statusLog[0].reason}
          {' · '}
          {clock(live.statusLog[0].at)}
        </div>
      )}
    </section>
  );
}

function RawTable({ live, justArrivedId }: { live?: RawLiveFeed; justArrivedId: number | null }) {
  return (
    <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
      <div className="max-h-[420px] overflow-auto p-2">
        {!live?.rows.length && (
          <p className="px-2 py-8 text-center text-sm text-slate-500">Waiting for raw_vbox_data rows.</p>
        )}
        {!!live?.rows.length && (
          <table className="min-w-max text-left text-[11px] text-slate-300">
            <thead className="sticky top-0 z-10 bg-slate-900 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-2 py-2 font-medium">received_at</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">id</th>
                {TABLE_FIELDS.map((key) => (
                  <th key={key} className="whitespace-nowrap px-2 py-2 font-medium">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {live.rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`border-t border-slate-800/80 ${
                    index === 0 ? 'bg-tea-500/10 text-slate-100' : 'hover:bg-slate-800/40'
                  } ${justArrivedId === row.id ? 'live-row-arrive' : ''}`}
                >
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono">{cellValue(row.receivedAt, 'inserted_at')}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-sky-400">{row.id}</td>
                  {TABLE_FIELDS.map((key) => (
                    <td key={key} className="whitespace-nowrap px-2 py-1.5 font-mono">
                      {cellValue(row.payload[key], key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="max-h-[420px] overflow-y-auto border-t border-slate-800 px-3 py-2 lg:border-l lg:border-t-0">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Connect / disconnect</div>
        {!live?.statusLog.length && <p className="py-4 text-xs text-slate-500">Status changes show up here.</p>}
        {live?.statusLog.map((entry, i) => (
          <div key={`${entry.at}-${i}`} className="border-b border-slate-800/80 py-2 text-xs">
            <div className={entry.state === 'connected' ? 'font-medium text-tea-400' : 'font-medium text-red-300'}>
              {entry.state === 'connected' ? 'Connected' : 'Disconnected'}
            </div>
            <div className="text-slate-400">{entry.reason}</div>
            <div className="font-mono text-[10px] text-slate-500">{clock(entry.at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SampleCard({
  row,
  older,
  index,
  justArrived,
  flashKeys,
}: {
  row: RawVboxRow;
  older?: RawVboxRow;
  index: number;
  justArrived: boolean;
  flashKeys: Set<string> | null;
}) {
  const isLatest = index === 0;
  const flashing = isLatest && flashKeys ? READINGS.filter((field) => flashKeys.has(field.key)) : [];

  return (
    <article
      className={`rounded-xl border px-3 py-3 ${
        isLatest ? 'border-tea-500/40 bg-tea-500/10' : 'border-slate-800 bg-slate-950/30'
      } ${justArrived ? 'live-row-arrive' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
            isLatest ? 'bg-tea-500 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          {index + 1}
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums text-slate-100">{clock(row.receivedAt)}</span>
        <span className="font-mono text-xs text-sky-400">#{row.id}</span>
        {isLatest && (
          <span className="rounded-full bg-tea-500/20 px-2 py-0.5 text-[11px] font-semibold text-tea-300">
            {justArrived ? 'New row' : 'Latest'}
          </span>
        )}
        {older && <span className="text-[11px] text-slate-500">{gapLabel(row.receivedAt, older.receivedAt)}</span>}
        {isLatest && (
          <span className={`ml-auto text-[11px] ${flashing.length ? 'font-medium text-amber-300' : 'text-slate-500'}`}>
            {flashing.length ? `Changed: ${flashing.map((field) => field.label).join(', ')}` : 'Same readings'}
          </span>
        )}
      </div>

      {isLatest ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRIMARY.map((field) => (
              <Reading
                key={field.key}
                label={field.label}
                value={readingText(row.payload[field.key], field.digits)}
                unit={field.unit}
                changed={flashKeys?.has(field.key) ?? false}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SECONDARY.map((field) => {
              const changed = flashKeys?.has(field.key) ?? false;
              return (
                <span
                  key={field.key}
                  className={`rounded-full px-2 py-1 text-[11px] transition-colors duration-300 ${
                    changed ? 'reading-flash text-slate-50' : 'bg-slate-800/80 text-slate-400'
                  }`}
                >
                  {field.label} {readingText(row.payload[field.key], field.digits)} {field.unit}
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-8 text-sm text-slate-300">
          {PRIMARY.map((field) => (
            <span key={field.key}>
              <span className="text-slate-500">{field.label} </span>
              {readingText(row.payload[field.key], field.digits)}
              <span className="text-slate-500"> {field.unit}</span>
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function useFieldFlash(rows: RawVboxRow[] | undefined) {
  const row = rows?.[0];
  const [flash, setFlash] = useState<{ id: number; keys: string[] } | null>(null);
  const seenId = useRef<number | undefined>(undefined);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    const current = rowsRef.current?.[0];
    if (!current) return;
    if (seenId.current === current.id) return;
    seenId.current = current.id;
    // Zero rows arrive between real samples. Compare with the last real sample
    // so a box turns yellow only when that reading itself moved.
    const prior = (rowsRef.current ?? []).slice(1).find((candidate) => !isBlankSample(candidate));
    const keys =
      prior && !isBlankSample(current)
        ? READINGS.filter((field) => valueChanged(current.payload[field.key], prior.payload[field.key])).map((field) => field.key)
        : [];
    setFlash({ id: current.id, keys });
    const timer = window.setTimeout(() => {
      setFlash((existing) => (existing?.id === current.id ? { id: current.id, keys: [] } : existing));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [row?.id]);

  if (!row || flash?.id !== row.id) return new Set<string>();
  return new Set(flash.keys);
}

function useJustArrived(id: number | undefined) {
  const seen = useRef<number | undefined>(undefined);
  const [freshId, setFreshId] = useState<number | null>(null);

  useEffect(() => {
    if (id == null) return;
    if (seen.current != null && seen.current !== id) {
      setFreshId(id);
      const timer = window.setTimeout(() => {
        setFreshId((current) => (current === id ? null : current));
      }, 8000);
      seen.current = id;
      return () => window.clearTimeout(timer);
    }
    seen.current = id;
  }, [id]);

  return freshId;
}

function Reading({ label, value, unit, changed }: { label: string; value: string; unit: string; changed: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 transition-colors duration-300 ${changed ? 'reading-flash' : 'bg-black/10'}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="reading-value mt-0.5 text-xl font-semibold tabular-nums text-slate-50">
        {value}
        <span className="reading-unit ml-1 text-xs font-normal text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
        ok ? 'bg-tea-500/15 text-tea-300' : 'bg-red-500/15 text-red-300'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-tea-400' : 'bg-red-400'}`} />
      {label}
    </span>
  );
}

function formatAge(ageMs: number | null | undefined) {
  if (ageMs == null || Number.isNaN(ageMs)) return '—';
  const seconds = Math.max(0, Math.round(ageMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s ago`;
}

function cellValue(value: unknown, key: string) {
  if (value == null || value === '') return '—';
  if (key === 'timestamp' || key === 'inserted_at') {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return key === 'inserted_at' ? date.toLocaleString() : String(value).replace('T', ' ').slice(0, 19);
    }
  }
  if (key === 'sample_id' || key === 'withering_id') return String(value);
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value);
}

function clock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function gapLabel(newerIso: string, olderIso: string) {
  const ms = Date.parse(newerIso) - Date.parse(olderIso);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s after the row below`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s after the row below`;
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readingText(value: unknown, digits: number) {
  const n = asNumber(value);
  if (n == null) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function isBlankSample(row: RawVboxRow) {
  return PRIMARY.every((field) => {
    const n = asNumber(row.payload[field.key]);
    return n == null || Math.abs(n) < 1e-6;
  });
}

function valueChanged(next: unknown, prev: unknown) {
  const a = asNumber(next);
  const b = asNumber(prev);
  if (a == null && b == null) return String(next ?? '') !== String(prev ?? '');
  if (a == null || b == null) return true;
  return Math.abs(a - b) > 1e-6;
}
