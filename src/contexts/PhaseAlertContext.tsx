'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getPhase, useSimulator, type TroughPhase } from '@/contexts/SimulatorContext';
import { PhaseToastContainer } from '@/components/ui/PhaseToast';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PhaseToast {
  id: string;
  troughNumber: number;
  phase: TroughPhase;
  autoDismissMs: number;
}

export interface PhaseLogEntry {
  id: string;
  troughId: string;
  troughNumber: number;
  phase: TroughPhase;
  timestamp: number;
}

interface PhaseAlertContextValue {
  toasts: PhaseToast[];
  dismiss: (id: string) => void;
  log: PhaseLogEntry[];
  clearLog: () => void;
}

// ── Sound ─────────────────────────────────────────────────────────────────────

const PHASE_TONES: Record<TroughPhase, number[]> = {
  SMR:  [523, 659, 784],       // C5-E5-G5 — ascending start signal
  IMR1: [659, 784],             // E5-G5
  LTO:  [784, 659, 523],        // descending warning
  IMR2: [659, 784],
  DONE: [523, 659, 784, 1047],  // C5-E5-G5-C6 — triumphant finish
};

function playAlertSound(phase: TroughPhase) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const freqs = PHASE_TONES[phase];
    let t = ctx.currentTime;
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
      osc.start(t);
      osc.stop(t + 0.22);
      t += 0.14;
    }
  } catch {
    // AudioContext blocked or unavailable — skip sound silently
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const PhaseAlertContext = createContext<PhaseAlertContextValue | null>(null);

export function usePhaseAlerts() {
  const ctx = useContext(PhaseAlertContext);
  if (!ctx) throw new Error('usePhaseAlerts must be inside PhaseAlertProvider');
  return ctx;
}

// Max log entries kept in memory (newest first)
const MAX_LOG = 200;

// ── Provider ──────────────────────────────────────────────────────────────────

export function PhaseAlertProvider({ children }: { children: React.ReactNode }) {
  const { state } = useSimulator();
  const [toasts, setToasts] = useState<PhaseToast[]>([]);
  const [log, setLog] = useState<PhaseLogEntry[]>([]);

  // Track last known phase per trough.
  // undefined = never seen, null = not started, string = current phase
  const prevPhaseRef = useRef<Record<string, TroughPhase | null | undefined>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearLog = useCallback(() => setLog([]), []);

  const fire = useCallback((troughId: string, troughNumber: number, phase: TroughPhase, eventId: string) => {
    const autoDismissMs = phase === 'DONE' ? 8000 : 6000;
    const toast: PhaseToast = { id: eventId, troughNumber, phase, autoDismissMs };
    setToasts((prev) => [toast, ...prev].slice(0, 5));

    const entry: PhaseLogEntry = { id: eventId, troughId, troughNumber, phase, timestamp: Date.now() };
    setLog((prev) => [entry, ...prev].slice(0, MAX_LOG));

    playAlertSound(phase);
  }, []);

  useEffect(() => {
    if (!state.loaded) return;

    for (const [id, t] of Object.entries(state.troughs)) {
      const started = t.running || t.idx > 0;

      if (!started) {
        prevPhaseRef.current[id] = null;
        continue;
      }

      const point = t.data.timeSeries[t.idx] ?? t.data.timeSeries[0];
      const currentPhase = getPhase(
        t.data.session,
        t.data.events,
        point?.timestamp ?? t.data.session.session_start,
      );

      const prev = prevPhaseRef.current[id];

      if (prev === undefined) {
        // First time seeing this trough after mount — record without alerting
        prevPhaseRef.current[id] = currentPhase;
      } else if (prev !== currentPhase) {
        // Phase transition — fire alert
        prevPhaseRef.current[id] = currentPhase;
        fire(id, t.data.session.trough_number, currentPhase, `${id}-${currentPhase}-${Date.now()}`);
      }
    }
  }, [state, fire]);

  return (
    <PhaseAlertContext.Provider value={{ toasts, dismiss, log, clearLog }}>
      {children}
      <PhaseToastContainer toasts={toasts} onDismiss={dismiss} />
    </PhaseAlertContext.Provider>
  );
}
