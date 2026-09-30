import clsx from 'clsx';
import { BATCH_STATUS_STYLE, SEVERITY_STYLE, TROUGH_STATUS_STYLE } from '@/lib/sensors';
import type { AlertSeverity, BatchStatus, TroughStatus } from '@/types';

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TroughStatusBadge({ status }: { status: TroughStatus }) {
  const s = TROUGH_STATUS_STYLE[status];
  return (
    <Badge className={s.className}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {s.label}
    </Badge>
  );
}

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const s = BATCH_STATUS_STYLE[status];
  return <Badge className={s.className}>{s.label}</Badge>;
}

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const s = SEVERITY_STYLE[severity];
  return <Badge className={s.className}>{s.label}</Badge>;
}
