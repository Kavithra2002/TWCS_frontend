import { format, formatDistanceToNowStrict } from 'date-fns';

export function fmtNumber(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Display code for a trough: `WT-01` / `trough-01` → `Trough-01`. */
export function fmtTroughCode(code: string | null | undefined): string {
  if (!code) return '—';
  const digits = code.match(/(\d+)\s*$/)?.[1];
  if (digits) return `Trough-${digits.padStart(2, '0')}`;
  return code;
}

/** Stable plant code used in DB / demo stores. */
export function troughPlantCode(n: number): string {
  return `Trough-${String(n).padStart(2, '0')}`;
}

export const fmtTime = (iso: string | number | Date) => format(new Date(iso), 'HH:mm');
export const fmtTimeSec = (iso: string | number | Date) => format(new Date(iso), 'HH:mm:ss');
export const fmtDateTime = (iso: string | number | Date) => format(new Date(iso), 'dd MMM yyyy, HH:mm');
export const fmtShortDateTime = (iso: string | number | Date) => format(new Date(iso), 'dd MMM HH:mm');
export const fmtAgo = (iso: string | number | Date) => `${formatDistanceToNowStrict(new Date(iso))} ago`;

export function fmtDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "HH:mm" -> minutes since midnight */
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
