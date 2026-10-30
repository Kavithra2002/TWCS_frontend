'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { api } from '@/lib/api';
import { LIVE_TROUGH_ID, vboxRowsToPoints } from '@/lib/live-trough';
import type { SimTroughData, SimPoint, SimSession, SimEvent } from '@/lib/sim-data';
import {
  buildSimRunRecord,
  clearSimRunHistory,
  isSimSessionFinished,
  loadSimRunHistory,
  saveSimRunHistory,
  type SimRunRecord,
  type SimRunSnapshot,
} from '@/lib/sim-run-history';
import type { TestVersionStatus } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TroughPhase = 'SMR' | 'IMR1' | 'LTO' | 'IMR2' | 'DONE';

export interface SimTroughState {
  data: SimTroughData;
  idx: number;
  running: boolean;
  /** Trough 6 only. Real VNet samples. Empty until the SSH feed sends a non-zero row. */
  livePoints: SimPoint[];
  liveError: string | null;
  tunnel: 'idle' | 'connecting' | 'open' | 'error';
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
  | { type: 'TICK'; id: string }
  | { type: 'TUNNEL'; id: string; tunnel: SimTroughState['tunnel']; liveError: string | null }
  | { type: 'LIVE_POINTS'; id: string; points: SimPoint[] };

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'LOAD': {
      const troughs: Record<string, SimTroughState> = {};
      for (const d of action.troughs) {
        const data = d.id === LIVE_TROUGH_ID ? { ...d, events: [], timeSeries: [] } : d;
        troughs[data.id] = {
          data,
          idx: 0,
          running: false,
          livePoints: [],
          liveError: null,
          tunnel: 'idle',
        };
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
    case 'CLEAR': {
      const current = state.troughs[action.id];
      if (!current) return state;
      return {
        ...state,
        troughs: {
          ...state.troughs,
          [action.id]: {
            ...current,
            idx: 0,
            running: false,
            livePoints: [],
            liveError: null,
            tunnel: 'idle',
          },
        },
      };
    }
    case 'TUNNEL': {
      const current = state.troughs[action.id];
      if (!current) return state;
      return {
        ...state,
        troughs: {
          ...state.troughs,
          [action.id]: { ...current, tunnel: action.tunnel, liveError: action.liveError },
        },
      };
    }
    case 'LIVE_POINTS': {
      const current = state.troughs[action.id];
      if (!current) return state;
      const merged = new Map<string, SimPoint>();
      for (const point of current.livePoints) merged.set(point.timestamp, point);
      for (const point of action.points) merged.set(point.timestamp, point);
      const livePoints = [...merged.values()]
        .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
        .slice(-800);
      return {
        ...state,
        troughs: {
          ...state.troughs,
          [action.id]: { ...current, livePoints },
        },
      };
    }
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
      if (!t || !t.running || t.data.id === LIVE_TROUGH_ID) return state;
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
  /** Finished / aborted simulator sessions — shown on Batches as Completed. */
  runHistory: SimRunRecord[];
  /** Wall-clock ms when the current session was started (for live run-log ordering). */
  getWallStartedAt: (id: string) => number | undefined;
  play: (id: string) => void;
  stop: (id: string) => void;
  playAll: () => void;
  stopAll: () => void;
  clear: (id: string) => void;
  clearAllSessions: () => void;
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
  const [runHistory, setRunHistory] = useState<SimRunRecord[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const wallStartRef = useRef<Record<string, number>>({});
  const archivedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Ignore older storage keys; v4 is empty until new sessions finish.
    localStorage.removeItem('twcs.sim-run-history.v1');
    localStorage.removeItem('twcs.sim-run-history.v2');
    localStorage.removeItem('twcs.sim-run-history.v3');
    const loaded = loadSimRunHistory();
    setRunHistory(loaded);
    archivedRef.current = new Set(loaded.map((r) => r.id));
  }, []);

  const persistArchive = useCallback((record: SimRunRecord) => {
    if (archivedRef.current.has(record.id)) return;
    archivedRef.current.add(record.id);
    setRunHistory((prev) => {
      const next = [record, ...prev.filter((r) => r.id !== record.id)];
      saveSimRunHistory(next);
      return next;
    });
  }, []);

  const archive = useCallback(
    (sim: SimTroughState, status: 'COMPLETED' | 'ABORTED') => {
      const wall = wallStartRef.current[sim.data.id] ?? Date.now();
      const snapshot: SimRunSnapshot = {
        id: sim.data.id,
        data: sim.data.id === LIVE_TROUGH_ID ? { ...sim.data, timeSeries: sim.livePoints } : sim.data,
        idx: sim.data.id === LIVE_TROUGH_ID ? Math.max(0, sim.livePoints.length - 1) : sim.idx,
        running: sim.running,
      };
      const record = buildSimRunRecord(snapshot, status, wall);
      persistArchive(record);
      delete wallStartRef.current[sim.data.id];
    },
    [persistArchive],
  );

  // Load data once on mount
  useEffect(() => {
    fetch('/api/sim-data')
      .then((r) => r.json())
      .then((troughs: SimTroughData[]) => dispatch({ type: 'LOAD', troughs }))
      .catch(console.error);
  }, []);

  // Tick running troughs; archive when a session finishes
  useEffect(() => {
    const timer = setInterval(() => {
      const s = stateRef.current;
      for (const [id, t] of Object.entries(s.troughs)) {
        if (!t.running || t.data.id === LIVE_TROUGH_ID) continue;
        const next = t.idx + 1;
        if (next >= t.data.timeSeries.length) {
          const finished: SimTroughState = {
            ...t,
            idx: t.data.timeSeries.length - 1,
            running: false,
          };
          archive(finished, 'COMPLETED');
        }
        dispatch({ type: 'TICK', id });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [archive]);

  // Also catch finished state if tick already stopped running
  useEffect(() => {
    for (const t of Object.values(state.troughs)) {
      if (isSimSessionFinished(t)) {
        const wall = wallStartRef.current[t.data.id];
        if (wall != null) archive(t, 'COMPLETED');
      }
    }
  }, [state.troughs, archive]);

  const markWallStart = useCallback((id: string) => {
    const t = stateRef.current.troughs[id];
    if (!t) return;
    if (t.idx === 0 || wallStartRef.current[id] == null) {
      wallStartRef.current[id] = Date.now();
    }
  }, []);

  const connectLiveTrough = useCallback(async (id: string) => {
    try {
      await api('/test-version/tunnel', { method: 'POST', live: true });
      dispatch({ type: 'TUNNEL', id, tunnel: 'open', liveError: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open the SSH tunnel';
      dispatch({ type: 'TUNNEL', id, tunnel: 'error', liveError: message });
    }
  }, []);

  const closeLiveTrough = useCallback(async (id: string) => {
    dispatch({ type: 'TUNNEL', id, tunnel: 'idle', liveError: null });
    try {
      await api('/test-version/tunnel/close', { method: 'POST', live: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not close the SSH tunnel';
      dispatch({ type: 'TUNNEL', id, tunnel: 'error', liveError: message });
    }
  }, []);

  const play = useCallback(
    (id: string) => {
      markWallStart(id);
      dispatch({ type: 'PLAY', id });
      if (id === LIVE_TROUGH_ID) {
        dispatch({ type: 'TUNNEL', id, tunnel: 'connecting', liveError: null });
        void connectLiveTrough(id);
      }
    },
    [markWallStart, connectLiveTrough],
  );

  const stop = useCallback((id: string) => {
    dispatch({ type: 'STOP', id });
    if (id === LIVE_TROUGH_ID) void closeLiveTrough(id);
  }, [closeLiveTrough]);

  const playAll = useCallback(() => {
    const ids = Object.keys(stateRef.current.troughs);
    for (const id of ids) markWallStart(id);
    dispatch({ type: 'PLAY_ALL' });
    if (ids.includes(LIVE_TROUGH_ID)) {
      dispatch({ type: 'TUNNEL', id: LIVE_TROUGH_ID, tunnel: 'connecting', liveError: null });
      void connectLiveTrough(LIVE_TROUGH_ID);
    }
  }, [markWallStart, connectLiveTrough]);

  const stopAll = useCallback(() => {
    const liveWasRunning = stateRef.current.troughs[LIVE_TROUGH_ID]?.running ?? false;
    dispatch({ type: 'STOP_ALL' });
    if (liveWasRunning) void closeLiveTrough(LIVE_TROUGH_ID);
  }, [closeLiveTrough]);

  const clear = useCallback(
    (id: string) => {
      const t = stateRef.current.troughs[id];
      if (t && t.idx > 0) {
        archive(t, isSimSessionFinished(t) ? 'COMPLETED' : 'ABORTED');
      }
      dispatch({ type: 'CLEAR', id });
    },
    [archive],
  );

  const clearAllSessions = useCallback(() => {
    clearSimRunHistory();
    setRunHistory([]);
    archivedRef.current = new Set();
    wallStartRef.current = {};
    for (const id of Object.keys(stateRef.current.troughs)) {
      dispatch({ type: 'CLEAR', id });
    }
  }, []);

  const setIdx = useCallback((id: string, idx: number) => {
    if (idx > 0) markWallStart(id);
    dispatch({ type: 'SET_IDX', id, idx });
  }, [markWallStart]);

  const getWallStartedAt = useCallback(
    (id: string) => wallStartRef.current[id],
    [],
  );

  const liveRunning = state.troughs[LIVE_TROUGH_ID]?.running ?? false;
  useEffect(() => {
    if (!liveRunning) return;
    let cancelled = false;

    const pull = async () => {
      try {
        const status = await api<TestVersionStatus>('/test-version/status', { live: true });
        if (cancelled) return;
        dispatch({
          type: 'LIVE_POINTS',
          id: LIVE_TROUGH_ID,
          points: vboxRowsToPoints(status.live?.rows ?? []),
        });
        if (!status.live?.watching) return;
        if (status.live.feedConnected) {
          dispatch({ type: 'TUNNEL', id: LIVE_TROUGH_ID, tunnel: 'open', liveError: null });
        } else if (status.live.dbConnected) {
          dispatch({
            type: 'TUNNEL',
            id: LIVE_TROUGH_ID,
            tunnel: 'open',
            liveError: 'Data is not being received. The VNet box may be off.',
          });
        } else {
          dispatch({
            type: 'TUNNEL',
            id: LIVE_TROUGH_ID,
            tunnel: 'error',
            liveError: status.live.error ?? 'The SSH tunnel is not open.',
          });
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Live feed unavailable';
        dispatch({ type: 'TUNNEL', id: LIVE_TROUGH_ID, tunnel: 'error', liveError: message });
      }
    };

    void pull();
    const timer = setInterval(() => void pull(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [liveRunning]);

  return (
    <SimulatorContext.Provider
      value={{
        state,
        runHistory,
        getWallStartedAt,
        play,
        stop,
        playAll,
        stopAll,
        clear,
        clearAllSessions,
        setIdx,
      }}
    >
      {children}
    </SimulatorContext.Provider>
  );
}

// ── Re-export types used by consumers ─────────────────────────────────────────
export type { SimTroughData, SimPoint, SimSession, SimEvent };
