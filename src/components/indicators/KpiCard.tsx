import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon: LucideIcon;
  color?: string;
  alert?: boolean;
}

export function KpiCard({ label, value, unit, hint, icon: Icon, color = '#2e9862', alert }: KpiCardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border bg-slate-900/60 p-4',
        alert ? 'border-red-500/40 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]' : 'border-slate-800',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}22` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-50">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
