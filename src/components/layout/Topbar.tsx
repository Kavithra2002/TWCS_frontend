'use client';

import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtime } from '@/components/providers/RealtimeProvider';
import { format } from 'date-fns';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, persona, logout } = useAuth();
  const { connected } = useRealtime();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs">
          <span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-emerald-400' : 'bg-red-500'}`} />
          <span className="text-slate-300">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {now && (
          <div className="hidden text-right sm:block">
            <p className="font-mono text-sm tabular-nums text-slate-100">{format(now, 'HH:mm:ss')}</p>
            <p className="text-[11px] text-slate-500">{format(now, 'EEE, dd MMM yyyy')}</p>
          </div>
        )}
        {user && (
          <div className="hidden items-center gap-2 text-right md:flex">
            {persona && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: persona.color }} aria-hidden />}
            <div>
              <p className="text-sm text-slate-100">{user.name}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{persona?.title ?? user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => {
            const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
            document.documentElement.classList.toggle('light', next === 'light');
            localStorage.setItem('twcs.theme', next);
          }}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-50"
          aria-label="Toggle color theme"
          title="Toggle color theme"
        >
          <Sun className="theme-icon-sun h-4 w-4" />
          <Moon className="theme-icon-moon h-4 w-4" />
        </button>
        <button onClick={logout} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-50" aria-label="Log out" title="Log out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
