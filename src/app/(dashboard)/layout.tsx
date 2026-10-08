'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { RealtimeProvider } from '@/components/providers/RealtimeProvider';
import { SimulatorProvider } from '@/contexts/SimulatorContext';
import { PhaseAlertProvider } from '@/contexts/PhaseAlertContext';
import { fetcher } from '@/lib/api';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  // Paint the shell only after mount so browser-injected attributes are not hydrated.
  if (!ready) return <div className="min-h-screen" suppressHydrationWarning />;

  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: false }}>
      <AuthProvider>
        <RealtimeProvider>
          <SimulatorProvider>
            <PhaseAlertProvider>
              {/* Subtle colour accents that complement the tea garden photo */}
              <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
                {/* Very light green tint at bottom — echoes the foreground foliage */}
                <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-t from-emerald-950/25 to-transparent" />
                {/* Soft sky-blue highlight at the top — matches the misty sky in the photo */}
                <div className="absolute left-0 right-0 top-0 h-[160px] bg-gradient-to-b from-sky-950/20 to-transparent" />
              </div>

              <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
              {menuOpen && (
                <div
                  className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
                  onClick={() => setMenuOpen(false)}
                />
              )}

              {/* Right-side wrapper — leaves a 12 px gap on all sides so every panel floats */}
              <div className="flex min-h-screen flex-col lg:pl-[264px]">
                <div className="px-3 pt-3">
                  <Topbar onMenu={() => setMenuOpen(true)} />
                </div>
                <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-3">
                  {children}
                </main>
              </div>
            </PhaseAlertProvider>
          </SimulatorProvider>
        </RealtimeProvider>
      </AuthProvider>
    </SWRConfig>
  );
}
