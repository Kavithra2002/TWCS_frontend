'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import type { SimTroughData, SimPoint, SimSession, SimEvent } from '@/lib/sim-data';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TroughPhase = 'SMR' | 'IMR1' | 'LTO' | 'IMR2' | 'DONE';

export interface SimTroughState {
  data: SimTroughData;
  idx: number;
  running: boolean;
}

interface SimState {
  troughs: Record<string, SimTroughState>;
  loaded: boolean;
}

type Action =
  | { type: 'LOAD'; troughs: SimTroughData[] }
  | { type: 'PLAY'; id: string }
  | { type: 'STOP'; id: string }
  | { type: 'PLAY_ALL' }
  | { type: 'STOP_ALL' }
  | { type: 'CLEAR'; id: string }
  | { type: 'SET_IDX'; id: string; idx: number }
  | { type: 'TICK'; id: string };

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'LOAD': {
      const troughs: Record<string, SimTroughState> = {};
      for (const d of action.troughs) {
        troughs[d.id] = { data: d, idx: 0, running: false };
      }
      return { troughs, loaded: true };
    }
    case 'PLAY':
      return {
        ...state,
        troughs: {
          ...state.troughs,
          [action.id]: { ...state.troughs[action.id], running: true },
        },
      };
    case 'STOP':
      return {
        ...state,
        troughs: {
          ...state.troughs,
          [action.id]: { ...state.troughs[action.id], running: false },
        },
      };
    case 'PLAY_ALL': {
      const troughs = { ...state.troughs };
      for (const id of Object.keys(troughs)) {
        troughs[id] = { ...troughs[id], running: true };
      }
      return { ...state, troughs };
    }
    case 'STOP_ALL': {
      const troughs = { ...state.troughs };
      for (const id of Object.keys(troughs)) {
        troughs[id] = { ...troughs[id], running: false };
      }
      return { ...state, troughs };
    }
    case 'CLEAR':
      return {
        ...state,
        troughs: {
          ...state.troughs,
          [action.id]: { ...state.troughs[action.id], idx: 0, running: false },
        },
      };
    case 'SET_IDX':
      return {
        ...state,
        troughs: {
          ...state.troughs,
          [action.id]: { ...state.troughs[action.id], idx: action.idx, running: false },
        },
      };
    case 'TICK': {
      const t = state.troughs[action.id];
      if (!t || !t.running) return state;
      const next = t.idx + 1;
      if (next >= t.data.timeSeries.length) {
        return {
          ...state,
          troughs: {
            ...state.troughs,
            [action.id]: { ...t, idx: t.data.timeSeries.length - 1, running: false },
          },
        };
      }
      return {
        ...state,
        troughs: {
          ...state.troughs,
          [action.id]: { ...t, idx: next },
        },
      };
    }
    default:
      return state;
  }
}

// ── Phase helper ──────────────────────────────────────────────────────────────

export function getPhase(session: SimSession, events: SimEvent[], currentTs: string): TroughPhase {
  const t = Date.parse(currentTs);
  const imr1 = Date.parse(session.imr1_start);
  const ltoStart = Date.parse(session.lto_start);
  const ltoDone = Date.parse(session.lto_done);
  const sessionEnd = Date.parse(session.session_end);
  if (t >= sessionEnd) return 'DONE';
  if (t >= ltoDone) return 'IMR2';
  if (t >= ltoStart) return 'LTO';
  if (t >= imr1) return 'IMR1';
  return 'SMR';
}

// ── Context ───────────────────────────────────────────────────────────────────

interface SimContextValue {
  state: SimState;
  play: (id: string) => void;
  stop: (id: string) => void;
  playAll: () => void;
  stopAll: () => void;
  clear: (id: string) => void;
  setIdx: (id: string, idx: number) => void;
}

const SimulatorContext = createContext<SimContextValue | null>(null);

export function useSimulator() {
  const ctx = useContext(SimulatorContext);
  if (!ctx) throw new Error('useSimulator must be used inside SimulatorProvider');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SimulatorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { troughs: {}, loaded: false });
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load data once on mount
  useEffect(() => {
    fetch('/api/sim-data')
      .then((r) => r.json())
      .then((troughs: SimTroughData[]) => dispatch({ type: 'LOAD', troughs }))
      .catch(console.error);
  }, []);

  // One interval per second that ticks all running troughs
  useEffect(() => {
    const timer = setInterval(() => {
      const s = stateRef.current;
      for (const [id, t] of Object.entries(s.troughs)) {
        if (t.running) dispatch({ type: 'TICK', id });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const play = useCallback((id: string) => dispatch({ type: 'PLAY', id }), []);
  const stop = useCallback((id: string) => dispatch({ type: 'STOP', id }), []);
  const playAll = useCallback(() => dispatch({ type: 'PLAY_ALL' }), []);
  const stopAll = useCallback(() => dispatch({ type: 'STOP_ALL' }), []);
  const clear = useCallback((id: string) => dispatch({ type: 'CLEAR', id }), []);
  const setIdx = useCallback((id: string, idx: number) => dispatch({ type: 'SET_IDX', id, idx }), []);

  return (
    <SimulatorContext.Provider value={{ state, play, stop, playAll, stopAll, clear, setIdx }}>
      {children}
    </SimulatorContext.Provider>
  );
}

// ── Re-export types used by consumers ─────────────────────────────────────────
export type { SimTroughData, SimPoint, SimSession, SimEvent };
