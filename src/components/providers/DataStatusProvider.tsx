'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { fetcher as apiFetcher } from '@/lib/api';

interface DataStatusValue {
  /** Epoch ms of the last successful data fetch */
  lastUpdatedAt: number;
  refreshing: boolean;
  /** Revalidate all SWR caches */
  refresh: () => Promise<void>;
}

const DataStatusContext = createContext<DataStatusValue | null>(null);

function DataStatusBridge({
  children,
  lastUpdatedAt,
  setLastUpdatedAt,
}: {
  children: ReactNode;
  lastUpdatedAt: number;
  setLastUpdatedAt: (t: number) => void;
}) {
  const { mutate } = useSWRConfig();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await mutate(() => true, undefined, { revalidate: true });
      setLastUpdatedAt(Date.now());
    } finally {
      setRefreshing(false);
    }
  }, [mutate, setLastUpdatedAt]);

  const value = useMemo(
    () => ({ lastUpdatedAt, refreshing, refresh }),
    [lastUpdatedAt, refreshing, refresh],
  );

  return (
    <DataStatusContext.Provider value={value}>{children}</DataStatusContext.Provider>
  );
}

/** Tracks last successful fetch time and exposes a global refresh. */
export function DataStatusProvider({ children }: { children: ReactNode }) {
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now());

  const trackingFetcher = useCallback(async <T,>(path: string) => {
    const data = await apiFetcher<T>(path);
    setLastUpdatedAt(Date.now());
    return data;
  }, []);

  return (
    <SWRConfig value={{ fetcher: trackingFetcher, revalidateOnFocus: false }}>
      <DataStatusBridge lastUpdatedAt={lastUpdatedAt} setLastUpdatedAt={setLastUpdatedAt}>
        {children}
      </DataStatusBridge>
    </SWRConfig>
  );
}

export function useDataStatus() {
  const ctx = useContext(DataStatusContext);
  if (!ctx) throw new Error('useDataStatus must be used within DataStatusProvider');
  return ctx;
}
