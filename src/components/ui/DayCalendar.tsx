'use client';

import clsx from 'clsx';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  max as maxDateFn,
  min as minDateFn,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface DayRange {
  from: Date;
  to: Date;
  /** Distinct calendar days included (supports multi-select). */
  days: Date[];
}

interface Props {
  /** Currently applied range (shown on the trigger). */
  value: DayRange;
  /** Called only when the user presses Apply. */
  onApply: (range: DayRange) => void;
  maxDate?: Date;
  minDate?: Date;
  className?: string;
}

function dayKey(d: Date) {
  return format(startOfDay(d), 'yyyy-MM-dd');
}

function sortDays(days: Date[]) {
  return [...days].sort((a, b) => a.getTime() - b.getTime());
}

function rangeFromDays(days: Date[]): DayRange {
  const sorted = sortDays(days.map((d) => startOfDay(d)));
  if (!sorted.length) {
    const today = startOfDay(new Date());
    return { from: today, to: today, days: [today] };
  }
  return { from: sorted[0], to: sorted[sorted.length - 1], days: sorted };
}

function labelFor(range: DayRange) {
  if (range.days.length === 1) return format(range.from, 'dd MMM yyyy');
  if (range.days.length === 2 && !isSameDay(range.from, range.to)) {
    return `${format(range.from, 'dd MMM')} – ${format(range.to, 'dd MMM yyyy')}`;
  }
  // Contiguous block?
  const spanDays =
    Math.round((startOfDay(range.to).getTime() - startOfDay(range.from).getTime()) / 86_400_000) + 1;
  if (spanDays === range.days.length) {
    return `${format(range.from, 'dd MMM')} – ${format(range.to, 'dd MMM yyyy')}`;
  }
  return `${range.days.length} days`;
}

export function DayCalendar({ value, onApply, maxDate, minDate, className }: Props) {
  const max = startOfDay(maxDate ?? new Date());
  const min = minDate ? startOfDay(minDate) : undefined;
  const appliedKey = value.days.map(dayKey).join(',');

  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(value.from));
  const [draftKeys, setDraftKeys] = useState<string[]>(() => value.days.map(dayKey));
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraftKeys(appliedKey ? appliedKey.split(',') : []);
    setAnchorKey(null);
    if (appliedKey) {
      const [y, m] = appliedKey.split(',')[0].split('-').map(Number);
      const next = new Date(y, m - 1, 1);
      setCursor((prev) => (prev.getTime() === next.getTime() ? prev : next));
    }
  }, [open, appliedKey]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const draftSet = useMemo(() => new Set(draftKeys), [draftKeys]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
  });

  const toggleOrRange = (day: Date, additive: boolean) => {
    const key = dayKey(day);
    if (additive) {
      setDraftKeys((prev) => {
        const set = new Set(prev);
        if (set.has(key)) set.delete(key);
        else set.add(key);
        return [...set];
      });
      setAnchorKey(key);
      return;
    }

    // Range: first click sets anchor; second click fills inclusive range
    if (!anchorKey || draftKeys.length === 0) {
      setDraftKeys([key]);
      setAnchorKey(key);
      return;
    }

    const a = startOfDay(new Date(anchorKey + 'T00:00:00'));
    const b = startOfDay(day);
    const lo = minDateFn([a, b]);
    const hi = maxDateFn([a, b]);
    const filled = eachDayOfInterval({ start: lo, end: hi }).map(dayKey);
    setDraftKeys(filled);
    setAnchorKey(null);
  };

  const apply = () => {
    if (!draftKeys.length) return;
    const daysSel = draftKeys.map((k) => startOfDay(new Date(k + 'T00:00:00')));
    onApply(rangeFromDays(daysSel));
    setOpen(false);
  };

  const selectToday = () => {
    const k = dayKey(max);
    setDraftKeys([k]);
    setAnchorKey(k);
  };

  const clearDraft = () => {
    setDraftKeys([]);
    setAnchorKey(null);
  };

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition',
          open
            ? 'border-[#111827]/20 bg-[#111827] text-white'
            : 'border-black/10 bg-white/70 text-[#111827] hover:bg-white',
        )}
        title="Pick one or more days"
      >
        <CalendarDays className="h-3.5 w-3.5 opacity-80" />
        <span className="tabular-nums">{labelFor(value)}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-[300px] rounded-xl border border-black/10 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor((c) => subMonths(c, 1))}
              className="rounded-md p-1 text-[#111827]/55 hover:bg-black/[0.05] hover:text-[#111827]"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-[#111827]">{format(cursor, 'MMMM yyyy')}</p>
            <button
              type="button"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="rounded-md p-1 text-[#111827]/55 hover:bg-black/[0.05] hover:text-[#111827]"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-2 text-[10px] leading-snug text-[#111827]/45">
            Click two days for a range, or hold Ctrl/Cmd and click to add/remove days. Then Apply.
          </p>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-[#111827]/40">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const inMonth = isSameMonth(day, cursor);
              const key = dayKey(day);
              const selected = draftSet.has(key);
              const today = isSameDay(day, max);
              const tooLate = isAfter(day, max);
              const tooEarly = min ? isBefore(day, min) : false;
              const disabled = tooLate || tooEarly;

              const draftDates = draftKeys.map((k) => startOfDay(new Date(k + 'T00:00:00')));
              const inSpan =
                draftDates.length >= 2 &&
                isWithinInterval(day, {
                  start: minDateFn(draftDates),
                  end: maxDateFn(draftDates),
                });

              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={(e) => toggleOrRange(day, e.metaKey || e.ctrlKey)}
                  className={clsx(
                    'h-8 rounded-md text-xs tabular-nums transition',
                    !inMonth && 'text-[#111827]/25',
                    inMonth && !selected && !inSpan && 'text-[#111827]/75 hover:bg-black/[0.06]',
                    inSpan && !selected && 'bg-[#111827]/08 text-[#111827]',
                    selected && 'bg-[#111827] font-semibold text-white',
                    today && !selected && 'ring-1 ring-tea-600/40',
                    disabled && 'cursor-not-allowed opacity-30 hover:bg-transparent',
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-black/[0.06] pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectToday}
                className="text-[11px] font-medium text-tea-700 hover:text-tea-600"
              >
                Today
              </button>
              <button
                type="button"
                onClick={clearDraft}
                className="text-[11px] font-medium text-[#111827]/45 hover:text-[#111827]"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-[#111827]/40">
                {draftKeys.length ? `${draftKeys.length} selected` : 'None'}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-[#111827]/55 hover:bg-black/[0.04]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!draftKeys.length}
                onClick={apply}
                className="rounded-md bg-[#111827] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Local-day bounds as ISO strings for API filters. */
export function dayBounds(day: Date): { from: string; to: string; label: string } {
  const start = startOfDay(day);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    label: format(start, 'dd MMM yyyy'),
  };
}

export function rangeBounds(range: DayRange): { from: string; to: string; label: string } {
  const start = startOfDay(range.from);
  const end = startOfDay(range.to);
  end.setHours(23, 59, 59, 999);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    label: labelFor(range),
  };
}

export function isSameCalendarDay(a: Date, b: Date) {
  return isSameDay(startOfDay(a), startOfDay(b));
}

export function dateInDayKeys(iso: string | null | undefined, days: Date[]): boolean {
  if (!iso || !days.length) return false;
  const key = dayKey(new Date(iso));
  const keys = new Set(days.map(dayKey));
  return keys.has(key);
}

export function singleDayRange(day: Date = new Date()): DayRange {
  const d = startOfDay(day);
  return { from: d, to: d, days: [d] };
}
