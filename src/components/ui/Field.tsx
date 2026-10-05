import clsx from 'clsx';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function controlClass({
  icon = false,
  chevron = false,
  area = false,
}: { icon?: boolean; chevron?: boolean; area?: boolean } = {}) {
  return clsx(
    'w-full rounded-xl border border-slate-700 bg-slate-950 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-tea-500 focus:ring-2 focus:ring-tea-500/25 disabled:opacity-50',
    area ? 'min-h-20 resize-y py-2.5' : 'h-10',
    icon ? 'pl-10' : 'pl-3',
    chevron ? 'appearance-none pr-9' : 'pr-3',
  );
}

export function Field({
  label,
  icon: Icon,
  chevron = false,
  iconAlign = 'center',
  children,
  className,
}: {
  label: string;
  icon?: LucideIcon;
  chevron?: boolean;
  iconAlign?: 'center' | 'top';
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-300">{label}</span>
      <div className="relative">
        {Icon && (
          <Icon
            className={clsx(
              'pointer-events-none absolute left-3.5 h-4 w-4 text-slate-500',
              iconAlign === 'top' ? 'top-3' : 'top-1/2 -translate-y-1/2',
            )}
          />
        )}
        {children}
        {chevron && <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />}
      </div>
    </label>
  );
}

export function ToggleRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition',
        checked ? 'border-tea-500 bg-tea-600/10 text-slate-100' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500',
      )}
    >
      <span>{label}</span>
      <span
        className={clsx(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-tea-500 bg-tea-600 text-white' : 'border-slate-600',
        )}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}

export function FormAlert({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
      {children}
    </p>
  );
}
