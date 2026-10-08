import clsx from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Card({ title, subtitle, action, children, className, bodyClassName }: CardProps) {
  return (
    <section className={clsx('glass rounded-2xl transition-transform duration-200 hover:-translate-y-0.5', className)}>
      {(title || action) && (
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-[#111827]/60">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={clsx('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
