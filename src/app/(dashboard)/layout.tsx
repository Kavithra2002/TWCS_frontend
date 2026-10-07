'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { RealtimeProvider } from '@/components/providers/RealtimeProvider';
import { SimulatorProvider } from '@/contexts/SimulatorContext';
import { fetcher } from '@/lib/api';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  // Paint the shell only after mount so browser-injected attributes are not hydrated.
  if (!ready) return <div className="min-h-screen bg-slate-950" suppressHydrationWarning />;

  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: false }}>
      <AuthProvider>
        <RealtimeProvider>
          <SimulatorProvider>
            <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
            {menuOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMenuOpen(false)} />}
            <div className="lg:pl-60">
              <Topbar onMenu={() => setMenuOpen(true)} />
              <main className="mx-auto max-w-[1600px] p-4 lg:p-6">{children}</main>
            </div>
          </SimulatorProvider>
        </RealtimeProvider>
      </AuthProvider>
    </SWRConfig>
  );
}
