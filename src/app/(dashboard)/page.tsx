'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { Bell, Droplets, Layers, Leaf, Scale, Thermometer } from 'lucide-react';
import { SriLankaMap } from '@/components/climate/SriLankaMap';
import { StatusDonut } from '@/components/charts/StatusDonut';
import { KpiCard } from '@/components/indicators/KpiCard';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { SimTroughOfflineRow, SimTroughRunningCard } from '@/components/troughs/SimTroughOverviewCard';
import { useSimulator, type SimTroughState } from '@/contexts/SimulatorContext';
import { isOverviewOnlyRole, overviewTitleForRole, roleLabel } from '@/lib/auth';
import { fmtNumber } from '@/lib/format';
import { SCHEDULE_ACTION_STYLE, SENSOR_META, TROUGH_STATUS_STYLE } from '@/lib/sensors';
import type { DashboardOverview, TodaySchedules } from '@/types';

export default function DashboardPage() {
  const { user } = useAuth();

  if (isOverviewOnlyRole(user)) {
    return <RoleOverviewView role={user!.role} />;
  }

  return <SuperAdminOverview />;
}

/** Placeholder landing page for Executive / Operation / Engineering. */
function RoleOverviewView({ role }: { role: string }) {
  return (
    <>
      <PageHeader
        title={overviewTitleForRole(role)}
        description={`${roleLabel(role)} workspace — more tools will appear here soon.`}
      />
      <Card>
        <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-2xl font-semibold tracking-tight text-[#111827]">{overviewTitleForRole(role)}</p>
          <p className="mt-2 max-w-md text-sm text-[#111827]/65">
            You are signed in as {roleLabel(role)}. Only Overview is available for this role right now.
          </p>
        </div>
      </Card>
    </>
  );
}

function SuperAdminOverview() {
  const { data, error } = useSWR<DashboardOverview>('/dashboard/overview', { refreshInterval: 30_000 });
  const { state: simState } = useSimulator();

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label="Loading dashboard…" />;

  const { kpis } = data;
  const avg = kpis.averages;

  const simTroughs = Object.values(simState.troughs);
  const simRunning = simTroughs.filter((t) => t.running).length;
  const simPaused  = simTroughs.filter((t) => !t.running && t.idx > 0).length;
  const simReady   = simTroughs.filter((t) => !t.running && t.idx === 0).length;
  const simTotal   = simTroughs.length;

  return (
    <>
      <PageHeader title="Overview" description="Live withering conditions across all troughs · Super admin" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Running troughs" value={`${simRunning}/${simTotal}`} icon={Layers} hint={`${simPaused} paused · ${simReady} ready`} />
        <KpiCard label="Avg air temp" value={fmtNumber(avg.airTemperature)} unit="°C" icon={Thermometer} color={SENSOR_META.AIR_TEMPERATURE.color} hint={`Leaf ${fmtNumber(avg.leafTemperature)} °C`} />
        <KpiCard label="Avg humidity" value={fmtNumber(avg.humidity)} unit="%RH" icon={Droplets} color={SENSOR_META.HUMIDITY.color} />
        <KpiCard label="Avg leaf moisture" value={fmtNumber(avg.leafMoisture)} unit="%" icon={Leaf} color={SENSOR_META.LEAF_MOISTURE.color} />
        <KpiCard label="Active batches" value={kpis.activeBatches} icon={Scale} color="#a78bfa" hint={`${fmtNumber(kpis.leafInProcessKg, 0)} kg green leaf`} />
        <KpiCard label="Open alerts" value={kpis.openAlerts} icon={Bell} color="#ef4444" alert={kpis.openAlerts > 0} hint={<Link href="/alerts" className="hover:text-slate-300">View all →</Link>} />
      </div>

      {/* 3-column grid: left 2 cols stacked, right col alongside */}
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        {/* Left column: withering troughs + Sri Lanka live map */}
        <div className="flex flex-col gap-3 xl:col-span-2">
          <Card
            title="Withering troughs"
            subtitle={
              simState.loaded
                ? `${simTotal} troughs · ${simRunning} running`
                : 'Loading simulator data…'
            }
          >
            {!simState.loaded ? (
              <Loading />
            ) : (
              <TroughList troughs={simTroughs} />
            )}
          </Card>
          <SriLankaMap />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3">
          <Card title="Trough status">
            <StatusDonut
              centerValue={String(simTotal || kpis.troughs.total)}
              centerLabel="troughs"
              legend
              slices={
                simTotal > 0
                  ? [
                      { name: 'Online',  value: simRunning, color: TROUGH_STATUS_STYLE.RUNNING.color },
                      { name: 'Paused',  value: simPaused,  color: TROUGH_STATUS_STYLE.IDLE.color },
                      { name: 'Offline', value: simReady,   color: '#ef4444' },
                    ]
                  : [
                      { name: 'Online',  value: kpis.troughs.running,     color: TROUGH_STATUS_STYLE.RUNNING.color },
                      { name: 'Idle',    value: kpis.troughs.idle,        color: TROUGH_STATUS_STYLE.IDLE.color },
                      { name: 'Offline', value: kpis.troughs.offline + kpis.troughs.maintenance, color: '#ef4444' },
                    ]
              }
            />
          </Card>
          <TodaySchedule />
        </div>
      </div>
    </>
  );
}

// ── Trough list: running = full cards, offline = compact rows ─────────────────
function TroughList({ troughs }: { troughs: SimTroughState[] }) {
  const active  = troughs.filter((t) => t.running || t.idx > 0);
  const offline = troughs.filter((t) => !t.running && t.idx === 0);

  return (
    <div className="space-y-3">
      {/* Full cards for running / paused troughs */}
      {active.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((t) => (
            <SimTroughRunningCard key={t.data.id} troughState={t} />
          ))}
        </div>
      )}

      {/* Compact offline rows */}
      {offline.length > 0 && (
        <div className="space-y-2">
          {active.length > 0 && (
            <p className="px-1 pt-1 text-[10px] font-medium uppercase tracking-widest text-slate-400">
              Offline · {offline.length}
            </p>
          )}
          {offline.map((t) => (
            <SimTroughOfflineRow key={t.data.id} troughState={t} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {active.length === 0 && offline.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-600">No trough data available</p>
      )}
    </div>
  );
}

function TodaySchedule() {
  const { data } = useSWR<TodaySchedules>('/schedules/today', { refreshInterval: 60_000 });
  const items = data?.items ?? [];
  const STATE = {
    ACTIVE: 'text-emerald-300',
    UPCOMING: 'text-sky-300',
    DONE: 'text-slate-500',
  };

  return (
    <Card
      title="Today's schedule"
      subtitle={data ? `Factory time ${data.now} (${data.timeZone})` : undefined}
      action={<Link href="/schedules" className="text-xs text-tea-400 hover:text-tea-300">Manage</Link>}
      bodyClassName="overflow-y-auto max-h-[464px]"
    >
      {!data ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing scheduled today" />
      ) : (
        <ul className="space-y-1.5 pr-1">
          {items.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg bg-slate-950/50 px-3 py-2">
              <span className="h-8 w-1 rounded-full" style={{ backgroundColor: SCHEDULE_ACTION_STYLE[s.action].color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">
                  <span className="font-medium text-slate-50">{s.troughCode}</span> · {s.name}
                </p>
                <p className="text-xs tabular-nums text-slate-500">
                  {s.startTime}–{s.endTime} · {SCHEDULE_ACTION_STYLE[s.action].label}
                </p>
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${STATE[s.state]}`}>{s.state}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
