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
        'glass rounded-2xl p-4 transition-transform duration-200 hover:-translate-y-0.5',
        alert && 'ring-1 ring-red-500/40',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}28` }}
        >
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
