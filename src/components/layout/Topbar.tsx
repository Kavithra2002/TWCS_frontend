'use client';

import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtime } from '@/components/providers/RealtimeProvider';
import { AlertDropdown } from '@/components/layout/AlertDropdown';
import { format } from 'date-fns';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const { connected } = useRealtime();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-3 z-30 flex h-14 items-center justify-between gap-4 rounded-2xl px-4 lg:px-5 glass">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Live indicator pill */}
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs backdrop-blur-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? 'animate-pulse bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]' : 'bg-red-500'
            }`}
          />
          <span className="font-medium text-slate-300">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Clock */}
        {now && (
          <div className="hidden text-right sm:block">
            <p className="font-mono text-sm tabular-nums text-slate-100">{format(now, 'HH:mm:ss')}</p>
            <p className="text-[11px] text-slate-500">{format(now, 'EEE, dd MMM yyyy')}</p>
          </div>
        )}

        {/* User info */}
        {user && (
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-slate-100">{user.name}</p>
            <p className="text-[11px] text-slate-500">{user.email}</p>
          </div>
        )}

        <AlertDropdown />

        {/* Theme toggle */}
        <button
          onClick={() => {
            const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
            document.documentElement.classList.toggle('light', next === 'light');
            localStorage.setItem('twcs.theme', next);
          }}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          aria-label="Toggle color theme"
          title="Toggle color theme"
        >
          <Sun className="theme-icon-sun h-4 w-4" />
          <Moon className="theme-icon-moon h-4 w-4" />
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
