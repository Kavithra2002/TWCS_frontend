import { fmtDuration, fmtNumber } from '@/lib/format';
import type { Batch } from '@/types';

/** Withering progress: how far leaf moisture has moved from intake toward the target. */
export function MoistureProgress({ batch, currentMoisture }: { batch: Batch; currentMoisture?: number | null }) {
  const current = currentMoisture ?? batch.currentMoisture;
  const pct =
    current == null
      ? batch.progressPct ?? 0
      : Math.min(100, Math.max(0, ((batch.initialMoisture - current) / (batch.initialMoisture - batch.targetMoisture)) * 100));

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-slate-400">
          {batch.code} · {fmtNumber(batch.leafIntakeKg, 0)} kg
        </span>
        <span className="font-medium tabular-nums text-tea-300">{fmtNumber(pct, 0)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-tea-600 to-tea-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>Start {fmtNumber(batch.initialMoisture)}%</span>
        <span>Now {fmtNumber(current)}%</span>
        <span>Target {fmtNumber(batch.targetMoisture)}%</span>
        <span>{fmtDuration(batch.elapsedMinutes)}</span>
      </div>
    </div>
  );
}
