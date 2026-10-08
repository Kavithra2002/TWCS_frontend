'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, CheckCircle2, Leaf, Wind, X } from 'lucide-react';
import type { PhaseToast } from '@/contexts/PhaseAlertContext';
import type { TroughPhase } from '@/contexts/SimulatorContext';

// ── Phase config ──────────────────────────────────────────────────────────────

interface PhaseConfig {
  title: string;
  subtitle: string;
  color: string;
  iconBg: string;
  Icon: React.ElementType;
}

const PHASE_CONFIG: Record<TroughPhase, PhaseConfig> = {
  SMR: {
    title: 'SMR Phase Started',
    subtitle: 'Starting Moisture Reduction is active',
    color: '#38bdf8',
    iconBg: 'rgba(56,189,248,0.15)',
    Icon: Leaf,
  },
  IMR1: {
    title: 'IMR1 Phase',
    subtitle: 'Initial Moisture Reduction 1 began',
    color: '#4ade80',
    iconBg: 'rgba(74,222,128,0.14)',
    Icon: Activity,
  },
  LTO: {
    title: 'LTO Phase',
    subtitle: 'Lie-to-Off sequence started',
    color: '#f59e0b',
    iconBg: 'rgba(245,158,11,0.14)',
    Icon: Wind,
  },
  IMR2: {
    title: 'IMR2 Phase',
    subtitle: 'Initial Moisture Reduction 2 began',
    color: '#2dd4bf',
    iconBg: 'rgba(45,212,191,0.14)',
    Icon: Activity,
  },
  DONE: {
    title: 'Session Complete',
    subtitle: 'Withering finished — target WS reached',
    color: '#22c55e',
    iconBg: 'rgba(34,197,94,0.14)',
    Icon: CheckCircle2,
  },
};

// ── Single toast ──────────────────────────────────────────────────────────────

function PhaseToastItem({
  toast,
  onDismiss,
}: {
  toast: PhaseToast;
  onDismiss: (id: string) => void;
}) {
  const cfg = PHASE_CONFIG[toast.phase];
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 320);
  };

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, toast.autoDismissMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { Icon } = cfg;

  const enterStyle = visible && !leaving
    ? { transform: 'translateX(0) scale(1)', opacity: 1 }
    : leaving
    ? { transform: 'translateX(115%) scale(0.94)', opacity: 0 }
    : { transform: 'translateX(115%) scale(0.96)', opacity: 0 };

  return (
    <div
      className="pointer-events-auto w-80 overflow-hidden rounded-2xl"
      style={{
        ...enterStyle,
        transition: leaving
          ? 'transform 0.30s cubic-bezier(0.4,0,1,1), opacity 0.25s ease'
          : 'transform 0.42s cubic-bezier(0.34,1.56,0.64,1), opacity 0.30s ease',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 12px rgba(0,0,0,0.10), 0 20px 40px rgba(0,0,0,0.12)',
      }}
    >
      {/* Main content row */}
      <div className="flex items-start gap-3.5 px-4 py-4">
        {/* Colored icon box */}
        <div
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: cfg.iconBg }}
        >
          <Icon className="h-5 w-5" style={{ color: cfg.color }} />
        </div>

        {/* Text block */}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-bold leading-snug text-gray-900">{cfg.title}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-gray-500">{cfg.subtitle}</p>
          <p className="mt-1 text-[11px] font-semibold" style={{ color: cfg.color }}>
            Trough {toast.troughNumber}
          </p>
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={dismiss}
          className="mt-0.5 shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress drain bar — bottom of card */}
      <div className="h-1 w-full bg-gray-100">
        <div
          className="toast-progress-bar h-full"
          style={{
            backgroundColor: cfg.color,
            animationDuration: `${toast.autoDismissMs}ms`,
          }}
        />
      </div>
    </div>
  );
}

// ── Container — fixed bottom-right, toasts stack upward ──────────────────────

export function PhaseToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: PhaseToast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-label="Phase alerts"
    >
      {toasts.map((t) => (
        <PhaseToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
