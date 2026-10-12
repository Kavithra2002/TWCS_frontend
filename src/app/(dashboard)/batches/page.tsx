'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Eye } from 'lucide-react';
import { BatchSessionModal } from '@/components/batches/BatchSessionModal';
import { BatchStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  dateInDayKeys,
  DayCalendar,
  isSameCalendarDay,
  rangeBounds,
  singleDayRange,
  type DayRange,
} from '@/components/ui/DayCalendar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { getPhase, useSimulator, type SimTroughState } from '@/contexts/SimulatorContext';
import { qs } from '@/lib/api';
import { fmtDateTime, fmtDuration, fmtNumber } from '@/lib/format';
import { isSimSessionFinished, simRunToBatch } from '@/lib/sim-run-history';
import type { Batch, BatchStatus, Trough } from '@/types';

type Period = 'today' | '7d' | '30d' | 'custom';
type StatusFilter = 'ALL' | 'WITHERING' | 'COMPLETED' | 'ABORTED';

function periodRange(
  period: Period,
  custom: DayRange,
): { from: string; to: string; label: string; includesToday: boolean; days: Date[] | null } {
  const now = new Date();
  if (period === 'custom') {
    const b = rangeBounds(custom);
    return {
      ...b,
      includesToday: custom.days.some((d) => isSameCalendarDay(d, now)),
      days: custom.days,
    };
  }
  const to = now;
  const from = new Date(to);
  if (period === 'today') {
    from.setHours(0, 0, 0, 0);
  } else if (period === '7d') {
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
  }
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    label: period === 'today' ? 'Today' : period === '7d' ? 'Last 7 days' : 'Last 30 days',
    includesToday: true,
    days: null,
  };
}

const LOG_STATUSES: BatchStatus[] = ['WITHERING', 'COMPLETED', 'ABORTED'];

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function simToOngoingBatch(
  sim: SimTroughState,
  apiTrough: Trough | undefined,
  wallStartedAt?: number,
): Batch {
  const session = sim.data.session;
  const n = session.trough_number;
  const code = `WT-${String(n).padStart(2, '0')}`;
  const point = sim.data.timeSeries[sim.idx] ?? sim.data.timeSeries[0];
  const first = sim.data.timeSeries[0];
  const startMs = Date.parse(session.session_start);
  const atMs = point ? Date.parse(point.timestamp) : startMs;
  const elapsedMinutes = Math.max(0, Math.round((atMs - startMs) / 60_000));
  const initialMoisture = first?.current_ws_pct ?? 100;
  const currentMoisture = point?.current_ws_pct ?? null;
  const targetMoisture = session.target_ws_pct;
  const span = initialMoisture - targetMoisture;
  const progressPct =
    currentMoisture != null && span > 0
      ? clamp(((initialMoisture - currentMoisture) / span) * 100, 0, 100)
      : sim.data.timeSeries.length > 1
        ? Math.round((sim.idx / (sim.data.timeSeries.length - 1)) * 100)
        : 0;

  const phase = getPhase(session, sim.data.events, point?.timestamp ?? session.session_start);
  // Wall-clock start so newest live runs sort to the top (not simulated session age).
  const startedAt = new Date(wallStartedAt ?? Date.now()).toISOString();

  return {
    id: `sim-run-${sim.data.id}`,
    code: `RUN-${code}`,
    troughId: apiTrough?.id ?? `trough-${String(n).padStart(2, '0')}`,
    troughCode: code,
    leafIntakeKg: session.starting_weight_kg,
    initialMoisture,
    targetMoisture,
    finalMoisture: null,
    status: 'WITHERING',
    plannedStartAt: null,
    startedAt,
    endedAt: null,
    notes: `${session.airflow_mode} · phase ${phase}${sim.running ? ' · running' : ' · paused'}`,
    createdAt: startedAt,
    currentMoisture,
    progressPct,
    elapsedMinutes,
  };
}

/** Newest process first; older runs sink to the bottom. */
function compareRunsNewestFirst(a: Batch, b: Batch): number {
  const ta = new Date(a.startedAt ?? a.createdAt ?? 0).getTime();
  const tb = new Date(b.startedAt ?? b.createdAt ?? 0).getTime();
  if (tb !== ta) return tb - ta;
  // Same start: keep ongoing above finished, then newest end time.
  if (a.status === 'WITHERING' && b.status !== 'WITHERING') return -1;
  if (b.status === 'WITHERING' && a.status !== 'WITHERING') return 1;
  const ea = a.endedAt ? new Date(a.endedAt).getTime() : 0;
  const eb = b.endedAt ? new Date(b.endedAt).getTime() : 0;
  if (eb !== ea) return eb - ea;
  return (b.id ?? '').localeCompare(a.id ?? '');
}

function matchesAppliedDays(batch: Batch, days: Date[] | null) {
  if (!days) return true;
  return dateInDayKeys(batch.startedAt, days) || dateInDayKeys(batch.endedAt, days);
}

export default function BatchesPage() {
  const { state: simState, runHistory, getWallStartedAt } = useSimulator();
  const [period, setPeriod] = useState<Period>('today');
  const [customRange, setCustomRange] = useState<DayRange>(() => singleDayRange());
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [viewing, setViewing] = useState<Batch | null>(null);

  const range = useMemo(() => periodRange(period, customRange), [period, customRange]);
  const key = `/batches${qs({
    from: range.from,
    to: range.to,
    status: status === 'ALL' ? undefined : status,
    limit: 200,
  })}`;

  // Poll DB every 3s so new sessions appear and finished ones move to historical
  const { data, error, mutate } = useSWR<Batch[]>(key, { refreshInterval: 3_000, keepPreviousData: true });
  const { data: troughs } = useSWR<Trough[]>('/troughs', { refreshInterval: 3_000 });

  const troughByCode = useMemo(
    () => new Map((troughs ?? []).map((t) => [t.code, t])),
    [troughs],
  );

  const liveOngoing = useMemo(() => {
    if (!simState.loaded || !range.includesToday) return [] as Batch[];
    return Object.values(simState.troughs)
      .filter((t) => (t.running || t.idx > 0) && !isSimSessionFinished(t))
      .map((t) => {
        const code = `WT-${String(t.data.session.trough_number).padStart(2, '0')}`;
        return simToOngoingBatch(t, troughByCode.get(code), getWallStartedAt(t.data.id));
      })
      .filter((b) => matchesAppliedDays(b, range.days))
      .sort(compareRunsNewestFirst);
  }, [simState, troughByCode, range.includesToday, range.days, getWallStartedAt]);

  const historyRuns = useMemo(() => {
    const fromMs = new Date(range.from).getTime();
    const toMs = new Date(range.to).getTime();
    return runHistory
      .filter((r) => {
        const t = new Date(r.startedAt).getTime();
        if (t < fromMs || t > toMs) return false;
        if (range.days && !dateInDayKeys(r.startedAt, range.days) && !dateInDayKeys(r.endedAt, range.days)) {
          return false;
        }
        return true;
      })
      .map((r) => {
        const code = `WT-${String(r.troughNumber).padStart(2, '0')}`;
        return simRunToBatch(r, troughByCode.get(code)?.id);
      });
  }, [runHistory, range.from, range.to, range.days, troughByCode]);

  const runs = useMemo(() => {
    const fromApi = (data ?? [])
      .filter((b) => LOG_STATUSES.includes(b.status))
      .filter((b) => matchesAppliedDays(b, range.days));
    const liveCodes = new Set(liveOngoing.map((b) => b.troughCode));
    const histIds = new Set(historyRuns.map((b) => b.id));
    const apiWithoutDup = fromApi.filter(
      (b) =>
        !(b.status === 'WITHERING' && b.troughCode && liveCodes.has(b.troughCode)) &&
        !histIds.has(b.id),
    );

    let merged = [...liveOngoing, ...historyRuns, ...apiWithoutDup];
    if (status === 'WITHERING') merged = merged.filter((b) => b.status === 'WITHERING');
    else if (status === 'COMPLETED') merged = merged.filter((b) => b.status === 'COMPLETED');
    else if (status === 'ABORTED') merged = merged.filter((b) => b.status === 'ABORTED');
    return merged.sort(compareRunsNewestFirst);
  }, [data, liveOngoing, historyRuns, status, range.days]);

  const viewingBatch = useMemo(() => {
    if (!viewing) return null;
    if (viewing.id.startsWith('sim-run-')) {
      return liveOngoing.find((b) => b.id === viewing.id) ?? viewing;
    }
    if (viewing.id.startsWith('sim-hist-')) {
      return historyRuns.find((b) => b.id === viewing.id) ?? viewing;
    }
    return viewing;
  }, [viewing, liveOngoing, historyRuns]);

  const calendarValue = useMemo(
    () => (period === 'custom' ? customRange : singleDayRange()),
    [period, customRange],
  );

  return (
    <>
      <PageHeader
        title="Withering batches"
        description="Select days on the calendar and Apply — records refresh from the DB every 3s; finished runs become historical"
      />

      <div className="glass rounded-xl px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={period === 'custom' ? null : period}
            onChange={(p) => {
              setPeriod(p);
              if (p === 'today') setCustomRange(singleDayRange());
            }}
            options={[
              { value: 'today', label: 'Today' },
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
            ]}
          />
          <DayCalendar
            value={calendarValue}
            onApply={(next) => {
              setCustomRange(next);
              setPeriod('custom');
            }}
          />
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'WITHERING', label: 'Ongoing' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'ABORTED', label: 'Aborted' },
            ]}
          />
          <p className="ml-auto text-[10px] text-[#111827]/40">Live refresh 3s</p>
        </div>
      </div>

      <Card className="mt-4" bodyClassName="p-0" title="Trough run log" subtitle={`${range.label} · past & ongoing`}>
        {error ? (
          <div className="p-4">
            <ErrorState error={error} />
          </div>
        ) : !data && !simState.loaded ? (
          <Loading />
        ) : runs.length === 0 ? (
          <EmptyState
            title={`No trough records for ${range.label}`}
            hint="Apply calendar days with sessions, or run a trough — finished runs show under Completed"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Trough</th>
                  <th>Status</th>
                  <th className="text-right">Intake</th>
                  <th>Moisture</th>
                  <th className="w-40">Progress</th>
                  <th>Duration</th>
                  <th>Started</th>
                  <th className="text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((b) => (
                  <tr key={b.id}>
                    <td className="font-medium text-[#111827]">{b.code}</td>
                    <td>
                      <Link
                        href={`/troughs/${b.troughId}`}
                        className="font-medium text-[#111827] hover:text-tea-700"
                      >
                        {b.troughCode}
                      </Link>
                    </td>
                    <td>
                      <BatchStatusBadge status={b.status} />
                    </td>
                    <td className="text-right tabular-nums text-[#111827]">
                      {fmtNumber(b.leafIntakeKg, 0)} kg
                    </td>
                    <td className="tabular-nums text-[#111827]/75">
                      {fmtNumber(b.initialMoisture)}% → {fmtNumber(b.currentMoisture ?? b.finalMoisture)}% /{' '}
                      {fmtNumber(b.targetMoisture)}%
                    </td>
                    <td>
                      {b.progressPct != null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
                            <div
                              className="h-full rounded-full bg-tea-600"
                              style={{ width: `${b.progressPct}%` }}
                            />
                          </div>
                          <span className="w-9 text-right text-xs tabular-nums text-[#111827]/50">
                            {fmtNumber(b.progressPct, 0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#111827]/35">—</span>
                      )}
                    </td>
                    <td className="tabular-nums text-[#111827]/60">{fmtDuration(b.elapsedMinutes)}</td>
                    <td className="whitespace-nowrap text-[#111827]/55">
                      {b.startedAt ? fmtDateTime(b.startedAt) : '—'}
                    </td>
                    <td className="text-right">
                      <Button size="sm" variant="secondary" onClick={() => setViewing(b)}>
                        <Eye className="h-3 w-3" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <BatchSessionModal
        batch={viewingBatch}
        open={viewingBatch != null}
        onClose={() => setViewing(null)}
        onChanged={() => mutate()}
      />
    </>
  );
}
