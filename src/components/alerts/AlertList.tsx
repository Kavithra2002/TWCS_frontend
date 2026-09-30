'use client';

import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import { EmptyState } from '@/components/ui/States';
import { fmtAgo } from '@/lib/format';
import type { Alert } from '@/types';

const ICON = {
  CRITICAL: <AlertOctagon className="h-4 w-4 text-red-400" />,
  WARNING: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  INFO: <Info className="h-4 w-4 text-sky-400" />,
};

export function AlertList({ alerts, emptyText = 'No open alerts' }: { alerts: Alert[]; emptyText?: string }) {
  if (alerts.length === 0) return <EmptyState title={emptyText} hint="All sensors within thresholds" />;
  return (
    <ul className="divide-y divide-slate-800">
      {alerts.map((a) => (
        <li key={a.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
          <span className="mt-0.5">{ICON[a.severity]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-200">
              {a.troughCode && <span className="mr-1.5 font-medium text-slate-50">{a.troughCode}</span>}
              {a.message}
            </p>
            <p className="text-xs text-slate-500">{fmtAgo(a.createdAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
