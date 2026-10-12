'use client';

import { BatchStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { fmtDateTime, fmtDuration, fmtNumber } from '@/lib/format';
import type { Batch } from '@/types';

interface Props {
  batch: Batch | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

interface LogStep {
  at: string;
  label: string;
  detail?: string;
  tone: 'neutral' | 'ok' | 'warn' | 'danger';
}

function buildProcessLog(batch: Batch): LogStep[] {
  const steps: LogStep[] = [
    {
      at: batch.createdAt,
      label: 'Batch created',
      detail: `${fmtNumber(batch.leafIntakeKg, 0)} kg intake · target ${fmtNumber(batch.targetMoisture)}%`,
      tone: 'neutral',
    },
  ];

  if (batch.plannedStartAt) {
    steps.push({
      at: batch.plannedStartAt,
      label: 'Planned start',
      detail: batch.notes ?? undefined,
      tone: 'neutral',
    });
  }

  if (batch.startedAt) {
    steps.push({
      at: batch.startedAt,
      label: 'Withering started',
      detail: `Initial moisture ${fmtNumber(batch.initialMoisture)}%`,
      tone: 'ok',
    });

    if (batch.status === 'WITHERING' || batch.status === 'COMPLETED' || batch.status === 'ABORTED') {
      const mid = new Date(
        new Date(batch.startedAt).getTime() + ((batch.elapsedMinutes ?? 60) * 60_000) / 2,
      ).toISOString();
      steps.push({
        at: mid,
        label: 'In-process check',
        detail:
          batch.currentMoisture != null
            ? `Moisture ${fmtNumber(batch.currentMoisture)}% · progress ${fmtNumber(batch.progressPct, 0)}%`
            : 'Climate and airflow monitored',
        tone: 'neutral',
      });
    }
  }

  if (batch.status === 'COMPLETED' && batch.endedAt) {
    steps.push({
      at: batch.endedAt,
      label: 'Session completed',
      detail: `Final moisture ${fmtNumber(batch.finalMoisture)}% · duration ${fmtDuration(batch.elapsedMinutes)}`,
      tone: 'ok',
    });
  }

  if (batch.status === 'ABORTED' && batch.endedAt) {
    steps.push({
      at: batch.endedAt,
      label: 'Session aborted',
      detail: batch.notes ?? 'Run stopped before target',
      tone: 'danger',
    });
  }

  if (batch.status === 'PLANNED') {
    steps.push({
      at: batch.createdAt,
      label: 'Awaiting start',
      detail: 'No withering session has started yet',
      tone: 'warn',
    });
  }

  return steps.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

const TONE: Record<LogStep['tone'], string> = {
  neutral: 'bg-[#111827]/25',
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  danger: 'bg-red-500',
};

export function BatchSessionModal({ batch, open, onClose }: Props) {
  if (!batch) return null;
  const log = buildProcessLog(batch);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={batch.code}
      description={`${batch.troughCode ?? 'Trough'} · session process log`}
      panelClassName="max-w-xl !border-black/10 !bg-white shadow-2xl [&_#modal-title]:!text-[#111827] [&>header_p]:!text-[#111827]/60 [&>header_button]:!text-[#111827]/50 [&>header_button:hover]:!bg-black/5 [&>header_button:hover]:!text-[#111827]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <BatchStatusBadge status={batch.status} />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-[#111827]/70 hover:bg-black/[0.04]"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Intake" value={`${fmtNumber(batch.leafIntakeKg, 0)} kg`} />
          <Metric
            label="Moisture"
            value={`${fmtNumber(batch.initialMoisture)}% → ${fmtNumber(batch.currentMoisture ?? batch.finalMoisture)}%`}
          />
          <Metric label="Target" value={`${fmtNumber(batch.targetMoisture)}%`} />
          <Metric label="Duration" value={fmtDuration(batch.elapsedMinutes)} />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#111827]/45">Process log</p>
          <ol className="space-y-0">
            {log.map((step, i) => (
              <li key={`${step.label}-${i}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${TONE[step.tone]}`} />
                  {i < log.length - 1 && <span className="my-1 w-px flex-1 bg-black/10" />}
                </div>
                <div className="min-w-0 flex-1 pb-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-[#111827]">{step.label}</p>
                    <p className="text-[11px] tabular-nums text-[#111827]/45">{fmtDateTime(step.at)}</p>
                  </div>
                  {step.detail && <p className="mt-0.5 text-xs text-[#111827]/55">{step.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {batch.notes && (
          <div className="rounded-xl border border-black/8 bg-black/[0.03] px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#111827]/45">Notes</p>
            <p className="mt-1 text-sm text-[#111827]/80 whitespace-pre-wrap">{batch.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/8 bg-black/[0.03] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[#111827]/45">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#111827]">{value}</p>
    </div>
  );
}
