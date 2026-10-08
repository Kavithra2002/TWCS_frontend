'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { AlertOctagon, AlertTriangle, Bell, Info } from 'lucide-react';
import { usePhaseAlerts } from '@/contexts/PhaseAlertContext';
import { fmtAgo } from '@/lib/format';
import type { Alert } from '@/types';

const SEV_ICON = {
  CRITICAL: <AlertOctagon className="h-3.5 w-3.5 text-red-400" />,
  WARNING:  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
  INFO:     <Info className="h-3.5 w-3.5 text-sky-400" />,
};

const PHASE_COLOR: Record<string, string> = {
  SMR: '#38bdf8', IMR1: '#4ade80', LTO: '#f59e0b', IMR2: '#2dd4bf', DONE: '#22c55e',
};

export function AlertDropdown() {
  const { data, mutate } = useSWR<Alert[]>('/alerts?status=open&limit=50', { refreshInterval: 15_000, revalidateOnMount: true });
  const { log } = usePhaseAlerts();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const sensorCount = data?.length ?? 0;
  const phaseCount  = log.length;
  const totalCount  = sensorCount + phaseCount;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Always fetch fresh data when the dropdown opens
  useEffect(() => {
    if (open) mutate();
  }, [open, mutate]);

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-50"
        aria-label="Alerts"
      >
        <Bell className={`h-4 w-4 ${totalCount > 0 ? 'text-slate-200' : ''}`} />

        {/* Animated badge */}
        {totalCount > 0 && (
          <>
            {/* Pulse ring */}
            <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full bg-red-500 opacity-40 animate-ping" />
            {/* Count badge */}
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          </>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900 shadow-2xl"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.60)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <p className="text-sm font-semibold text-slate-100">Alerts</p>
            <div className="flex items-center gap-2">
              {sensorCount > 0 && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
                  {sensorCount} sensor
                </span>
              )}
              {phaseCount > 0 && (
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                  {phaseCount} phase
                </span>
              )}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {/* Sensor alerts */}
            {data && data.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Sensor Alerts
                </p>
                <ul>
                  {data.slice(0, 5).map((a) => (
                    <li
                      key={a.id}
                      className="flex gap-3 border-b border-slate-800/50 px-4 py-2.5 last:border-b-0"
                    >
                      <span className="mt-0.5 shrink-0">{SEV_ICON[a.severity]}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-200">
                          <span className="font-semibold text-slate-50">{a.troughCode}</span>
                          {' · '}
                          {a.message}
                        </p>
                        <p className="text-[10px] text-slate-500">{fmtAgo(a.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {data.length > 5 && (
                  <p className="px-4 pb-2 text-[10px] text-slate-500">
                    +{data.length - 5} more sensor alerts
                  </p>
                )}
              </>
            )}

            {/* Phase events */}
            {log.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Simulator Phase Events
                </p>
                <ul>
                  {log.slice(0, 4).map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 border-b border-slate-800/50 px-4 py-2.5 last:border-b-0"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: PHASE_COLOR[e.phase] ?? '#94a3b8' }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-200">
                          <span className="font-semibold text-slate-50">Trough {e.troughNumber}</span>
                          {' · '}
                          <span style={{ color: PHASE_COLOR[e.phase] }}>{e.phase}</span>
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {fmtAgo(new Date(e.timestamp).toISOString())}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Empty */}
            {(!data || data.length === 0) && log.length === 0 && (
              <div className="py-8 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-slate-700" />
                <p className="text-sm text-slate-500">No active alerts</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-800 px-4 py-2.5">
            <Link
              href="/settings?tab=alerts"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-tea-400 hover:text-tea-300 transition-colors"
            >
              View all alerts in Settings →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
