import { SCHEDULE_ACTION_STYLE } from '@/lib/sensors';
import { toMinutes } from '@/lib/format';
import type { Schedule } from '@/types';

export interface TimelineRow {
  id: string;
  label: string;
  items: Schedule[];
}

const DAY = 24 * 60;
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

/** 24-hour Gantt-style view. Overlapping schedules are stacked in lanes. */
export function ScheduleTimeline({ rows, nowMinutes }: { rows: TimelineRow[]; nowMinutes?: number }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="relative ml-24 h-4 text-[10px] text-slate-500">
          {HOURS.map((h) => (
            <span
              key={h}
              className={`absolute whitespace-nowrap ${h === 0 ? '' : h === 24 ? '-translate-x-full' : '-translate-x-1/2'}`}
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>

        <div className="space-y-1.5">
          {rows.map((row) => {
            const lanes = assignLanes(row.items);
            const laneCount = Math.max(1, ...lanes.map((l) => l.lane + 1));
            return (
              <div key={row.id} className="flex items-stretch">
                <div className="flex w-24 shrink-0 items-center pr-2 text-xs font-medium text-slate-300">{row.label}</div>
                <div className="relative flex-1 rounded-md bg-slate-950/60 ring-1 ring-slate-800" style={{ height: laneCount * 22 + 6 }}>
                  {HOURS.slice(1, -1).map((h) => (
                    <div key={h} className="absolute inset-y-0 w-px bg-slate-800" style={{ left: `${(h / 24) * 100}%` }} />
                  ))}
                  {lanes.map(({ item, lane }) => {
                    const start = toMinutes(item.startTime);
                    const end = toMinutes(item.endTime);
                    const style = SCHEDULE_ACTION_STYLE[item.action];
                    return (
                      <div
                        key={item.id}
                        title={`${item.name} · ${style.label} · ${item.startTime}–${item.endTime}${item.setpoint != null ? ` · ${item.setpoint}` : ''}`}
                        className="absolute flex items-center overflow-hidden rounded px-1.5 text-[10px] font-medium text-white"
                        style={{
                          left: `${(start / DAY) * 100}%`,
                          width: `${Math.max(0.6, ((end - start) / DAY) * 100)}%`,
                          top: 3 + lane * 22,
                          height: 19,
                          backgroundColor: style.color,
                          opacity: item.enabled ? 0.9 : 0.3,
                        }}
                      >
                        <span className="truncate">{item.name}</span>
                      </div>
                    );
                  })}
                  {nowMinutes !== undefined && (
                    <div className="absolute inset-y-0 w-0.5 bg-red-500" style={{ left: `${(nowMinutes / DAY) * 100}%` }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="ml-24 mt-3 flex flex-wrap gap-3">
          {Object.entries(SCHEDULE_ACTION_STYLE).map(([key, s]) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function assignLanes(items: Schedule[]) {
  const sorted = [...items].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const laneEnds: string[] = [];
  return sorted.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.startTime);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.endTime;
    return { item, lane };
  });
}
