'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import type { IntakeCell, IntakeSnapshot, IntakeTableName, IntakeTableSnapshot } from '@/types';

const loadIntake = () => api<IntakeSnapshot>('/test-version/intake', { live: true });

const SESSION_COLUMNS = [
  'withering_id',
  'packet_version',
  'packet_type',
  'company_code',
  'factory_code',
  'trough_no',
  'session_start_year',
  'session_start_month',
  'session_start_day',
  'session_start_hour',
  'session_start_minute',
  'session_start_second',
  'session_sequence',
  'wither_period_min',
  'target_weight_kg',
  'smr_start_weight_kg',
  'end_weight_kg',
  'final_quality_code',
  'end_elapsed_min',
  'energy_speed_estimate_kwh',
  'energy_direct_vfd_kwh',
  'energy_power_integrated_kwh',
  'session_active',
  'airflow_mode_start_code',
  'withering_standard_pct',
  'target_dominance_code',
  'surface_moisture_pct',
  'standard_plucking_pct',
  'spread_thickness_in',
  'tea_master_start_id',
  'tea_master_end_id',
  'imr_start_weight_kg',
  'reserved_session_709',
  'reserved_session_710',
  'reserved_session_711',
  'reserved_session_712',
  'reserved_session_713',
  'inserted_at',
] as const;

const EVENT_COLUMNS = [
  'event_id',
  'packet_version',
  'packet_type',
  'event_sequence',
  'session_sequence',
  'company_code',
  'factory_code',
  'trough_no',
  'event_code',
  'event_year',
  'event_month',
  'event_day',
  'event_hour',
  'event_minute',
  'process_stage_code',
  'airflow_mode_code',
  'exit_reason_code',
  'elapsed_min',
  'event_weight_kg',
  'withering_standard_pct',
  'target_weight_kg',
  'first_fault_code',
  'event_flags',
  'event_ack_sequence',
  'event_commit_sequence',
  'event_communication_flags',
  'event_second',
  'energy_speed_estimate_kwh',
  'energy_direct_vfd_kwh',
  'energy_power_integrated_kwh',
  'fan_frequency_hz',
  'previous_process_stage_code',
  'reserved_event_1871',
  'inserted_at',
] as const;

const TIME_SERIES_COLUMNS = [
  'sample_id',
  'withering_id',
  'timestamp',
  'packet_version',
  'packet_type',
  'sample_sequence',
  'session_sequence',
  'process_stage_code',
  'status_flags',
  'upper_temperature_c',
  'lower_temperature_c',
  'inlet_temperature_c',
  'ambient_temperature_c',
  'upper_rh_pct',
  'lower_rh_pct',
  'inlet_rh_pct',
  'ambient_rh_pct',
  'chamber_pressure_pa',
  'current_leaf_weight_kg',
  'withering_standard_pct',
  'target_weight_kg',
  'elapsed_min',
  'time_to_target_min',
  'fan_frequency_hz',
  'pressure_setpoint_pa',
  'hot_louver_pct',
  'ambient_louver_pct',
  'vfd_power_kw',
  'energy_direct_vfd_kwh',
  'energy_power_integrated_kwh',
  'energy_speed_estimate_kwh',
  'first_fault_code',
  'aaw_active',
  'haw_active',
  'fault_present',
  'vfd_running',
  'heartbeat',
  'commit_sequence',
  'communication_status',
  'inserted_at',
] as const;

const TABLES: {
  name: IntakeTableName;
  title: string;
  hint: string;
  keyField: string;
  columns: readonly string[];
}[] = [
  {
    name: 'sessions',
    title: 'sessions',
    hint: 'One row for each withering run',
    keyField: 'withering_id',
    columns: SESSION_COLUMNS,
  },
  {
    name: 'events',
    title: 'events',
    hint: 'Stage changes and faults during a run',
    keyField: 'event_id',
    columns: EVENT_COLUMNS,
  },
  {
    name: 'time_series',
    title: 'time_series',
    hint: 'Live samples, newest first',
    keyField: 'sample_id',
    columns: TIME_SERIES_COLUMNS,
  },
];

export default function TestVersion2Page() {
  const { data, mutate, isValidating } = useSWR('test-version-2-intake', loadIntake, {
    refreshInterval: 2000,
    keepPreviousData: true,
  });

  return (
    <div className="[overflow-anchor:none]">
      <PageHeader
        title="Test Version 2"
        description="sessions, events, and time_series. Newest rows stay at the top."
        actions={
          <Button variant="secondary" onClick={() => void mutate()} disabled={isValidating}>
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {TABLES.map((table) => {
          const snapshot = data?.tables[table.name];
          const count = snapshot?.count;
          const fresh = isFresh(snapshot?.latestAt ?? null);
          return (
            <div key={table.name} className="glass rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-sm font-semibold text-slate-100">{table.title}</p>
                {fresh && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    Live
                  </span>
                )}
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">
                {count == null ? '—' : count.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {snapshot?.latestAt ? `Latest row ${formatAge(snapshot.latestAt)}` : 'Waiting for rows'}
              </p>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        {TABLES.map((table) => (
          <IntakeTable
            key={table.name}
            title={table.title}
            hint={table.hint}
            keyField={table.keyField}
            fallbackColumns={table.columns}
            snapshot={data?.tables[table.name]}
          />
        ))}
      </div>
    </div>
  );
}

function IntakeTable({
  title,
  hint,
  keyField,
  fallbackColumns,
  snapshot,
}: {
  title: string;
  hint: string;
  keyField: string;
  fallbackColumns: readonly string[];
  snapshot?: IntakeTableSnapshot;
}) {
  const columns = columnsFor(fallbackColumns, snapshot);
  const rows = snapshot?.rows ?? [];
  const ids = rows.map((row, index) => rowKey(row, keyField, index));
  const fresh = useFreshKeys(ids);

  return (
    <section className="glass rounded-2xl [overflow-anchor:none]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/40 px-4 py-3">
        <div>
          <h2 className="font-mono text-sm font-semibold text-slate-100">public.{title}</h2>
          <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
        </div>
        <p className="text-xs text-slate-400">
          {rows.length
            ? `Showing ${rows.length.toLocaleString()} of ${(snapshot?.count ?? rows.length).toLocaleString()}`
            : `${columns.length} columns`}
        </p>
      </header>

      <div className="max-h-[360px] overflow-auto [overflow-anchor:none]">
        <table className="min-w-max border-separate border-spacing-0 text-left text-[11px] text-slate-200">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap border-b border-slate-700/40 bg-slate-950/95 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          {rows.length > 0 && (
          <tbody>
            {rows.map((row, index) => {
              const id = ids[index];
              const arrived = fresh.has(id);
              return (
                <tr
                  key={id}
                  className={
                    arrived
                      ? 'bg-emerald-500/20'
                      : index === 0
                        ? 'bg-amber-400/15'
                        : 'hover:bg-white/[0.04]'
                  }
                >
                  {columns.map((column) => (
                    <td
                      key={column}
                      className="whitespace-nowrap border-b border-slate-700/30 px-2.5 py-1.5 font-mono tabular-nums"
                    >
                      {showCell(row[column])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          )}
        </table>
      </div>
      {!rows.length && <p className="px-4 py-6 text-sm text-slate-400">No rows in {title} yet.</p>}
    </section>
  );
}

function columnsFor(fallback: readonly string[], snapshot?: IntakeTableSnapshot) {
  const live = snapshot?.columns ?? [];
  if (!live.length) return [...fallback];
  const ordered = fallback.filter((column) => live.includes(column));
  for (const column of live) {
    if (!ordered.includes(column)) ordered.push(column);
  }
  return ordered;
}

function useFreshKeys(ids: string[]) {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const signature = ids.join('\n');

  useEffect(() => {
    const current = signature ? signature.split('\n') : [];
    if (seen.current == null) {
      if (!current.length) return;
      seen.current = new Set(current);
      return;
    }
    const arrived = current.filter((id) => id && !seen.current?.has(id));
    for (const id of current) seen.current.add(id);
    if (!arrived.length) return;
    setFresh(new Set(arrived));
    const timer = window.setTimeout(() => setFresh(new Set()), 1600);
    return () => window.clearTimeout(timer);
  }, [signature]);

  return fresh;
}

function rowKey(row: Record<string, IntakeCell>, keyField: string, index: number) {
  const value = row[keyField];
  return value == null || value === '' ? `${keyField}-${index}` : String(value);
}

function showCell(value: IntakeCell | undefined) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function parseDbTime(value: string | null) {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(normalized);
  const ms = Date.parse(hasZone ? normalized : `${normalized}Z`);
  return Number.isNaN(ms) ? null : ms;
}

function isFresh(value: string | null) {
  const ms = parseDbTime(value);
  if (ms == null) return false;
  const age = Date.now() - ms;
  return age >= -5_000 && age <= 25_000;
}

function formatAge(value: string | null) {
  const ms = parseDbTime(value);
  if (ms == null) return '—';
  const age = Date.now() - ms;
  if (age < 10_000) return 'just now';
  if (age < 60_000) return `${Math.round(age / 1000)}s ago`;
  if (age < 3_600_000) return `${Math.round(age / 60_000)}m ago`;
  return `${Math.round(age / 3_600_000)}h ago`;
}
