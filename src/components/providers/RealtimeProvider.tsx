'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSWRConfig } from 'swr';
import { AlertTriangle, X } from 'lucide-react';
import { USE_DEMO_DATA } from '@/lib/data-source';
import { getSocket } from '@/lib/socket';
import type { AlertEvent, LatestReading, ReadingEvent } from '@/types';

interface RealtimeState {
  connected: boolean;
  /** sensorId -> most recent live reading */
  readings: Record<string, LatestReading>;
}

const RealtimeContext = createContext<RealtimeState>({ connected: false, readings: {} });

const FLUSH_MS = 1000;

/**
 * Owns the Socket.IO connection. Readings are buffered and flushed once per
 * second to avoid re-rendering on every message; alerts / status changes
 * revalidate the matching SWR caches.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { mutate } = useSWRConfig();
  const [connected, setConnected] = useState(false);
  const [readings, setReadings] = useState<Record<string, LatestReading>>({});
  const [toast, setToast] = useState<AlertEvent | null>(null);
  const buffer = useRef<Record<string, LatestReading>>({});

  useEffect(() => {
    if (USE_DEMO_DATA) {
      setConnected(true);
      return;
    }
    const socket = getSocket();
    const revalidate = (...prefixes: string[]) =>
      mutate((key) => typeof key === 'string' && prefixes.some((p) => key.startsWith(p)));

    const onReading = (r: ReadingEvent) => {
      buffer.current[r.sensorId] = { value: r.value, recordedAt: r.recordedAt };
    };
    const onAlert = (a: AlertEvent) => {
      setToast(a);
      revalidate('/alerts', '/dashboard');
    };

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('reading', onReading);
    socket.on('alert', onAlert);
    socket.on('alert:acknowledged', () => revalidate('/alerts', '/dashboard'));
    socket.on('trough:status', () => revalidate('/troughs', '/dashboard'));
    socket.on('batch:changed', () => revalidate('/batches', '/dashboard', '/troughs'));
    socket.on('schedule:triggered', () => revalidate('/schedules'));
    if (socket.connected) setConnected(true);

    const timer = setInterval(() => {
      if (Object.keys(buffer.current).length === 0) return;
      const batch = buffer.current;
      buffer.current = {};
      setReadings((prev) => ({ ...prev, ...batch }));
    }, FLUSH_MS);

    return () => {
      clearInterval(timer);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reading', onReading);
      socket.off('alert', onAlert);
      socket.off('alert:acknowledged');
      socket.off('trough:status');
      socket.off('batch:changed');
      socket.off('schedule:triggered');
    };
  }, [mutate]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <RealtimeContext.Provider value={{ connected, readings }}>
      {children}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-amber-500/40 bg-slate-900 px-4 py-3 shadow-xl">
          <AlertTriangle className={toast.severity === 'CRITICAL' ? 'h-5 w-5 text-red-400' : 'h-5 w-5 text-amber-400'} />
          <div className="text-sm">
            <p className="font-medium text-slate-100">{toast.severity === 'CRITICAL' ? 'Critical alert' : 'Warning'}</p>
            <p className="text-slate-300">{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-500 hover:text-slate-50" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </RealtimeContext.Provider>
  );
}

export const useRealtime = () => useContext(RealtimeContext);

/** Returns whichever is newer: the live socket reading or the API snapshot. */
export function useLiveReading(sensorId: string | undefined, snapshot: LatestReading | null | undefined) {
  const { readings } = useRealtime();
  const live = sensorId ? readings[sensorId] : undefined;
  if (!live) return snapshot ?? null;
  if (!snapshot) return live;
  return new Date(live.recordedAt) > new Date(snapshot.recordedAt) ? live : snapshot;
}
