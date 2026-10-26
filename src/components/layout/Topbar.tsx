'use client';

import clsx from 'clsx';
import { LogOut, Menu, Moon, RefreshCw, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useDataStatus } from '@/components/providers/DataStatusProvider';
import { AlertDropdown } from '@/components/layout/AlertDropdown';
import { format } from 'date-fns';
import { LanguageSelect } from '@/components/layout/LanguageSelect';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { fill, type Lang, type Messages } from '@/lib/i18n';

const DATE_LOCALES: Record<Lang, string> = { en: 'en-GB', si: 'si-LK', ta: 'ta-LK' };

function formatAgo(seconds: number, labels: Messages['topbar']): string {
  if (seconds < 1) return labels.justNow;
  if (seconds < 60) return fill(labels.secondsAgo, { n: seconds });
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? fill(labels.minutesSecondsAgo, { m, s }) : fill(labels.minutesAgo, { n: m });
  const h = Math.floor(m / 60);
  return fill(labels.hoursMinutesAgo, { h, m: m % 60 });
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const { lang, t } = useLanguage();
  const { lastUpdatedAt, refreshing, refresh } = useDataStatus();
  const [now, setNow] = useState<Date | null>(null);
  const [agoSec, setAgoSec] = useState(0);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const tick = () => setAgoSec(Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [lastUpdatedAt]);

  return (
    <header className="sticky top-3 z-30 flex h-14 items-center justify-between gap-4 rounded-2xl px-4 lg:px-5 glass">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100 lg:hidden"
          aria-label={t.topbar.openMenu}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Last updated + manual refresh */}
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 py-1 pl-3 pr-1 text-xs backdrop-blur-sm">
          <span
            className={clsx(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              refreshing
                ? 'animate-pulse bg-sky-400'
                : agoSec <= 5
                  ? 'bg-emerald-400'
                  : agoSec <= 60
                    ? 'bg-amber-400'
                    : 'bg-slate-400',
            )}
          />
          <span className="font-medium tabular-nums text-slate-300">
            {refreshing ? t.topbar.updating : fill(t.topbar.updated, { time: formatAgo(agoSec, t.topbar) })}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="ml-0.5 rounded-full p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100 disabled:opacity-50"
            aria-label={t.topbar.refresh}
            title={t.topbar.refresh}
          >
            <RefreshCw className={clsx('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {now && (
          <div className="hidden text-right sm:block">
            <p className="font-mono text-sm tabular-nums text-slate-100">{format(now, 'HH:mm:ss')}</p>
            <p className="text-[11px] text-slate-500">
              {new Intl.DateTimeFormat(DATE_LOCALES[lang], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(now)}
            </p>
          </div>
        )}

        {user && (
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-slate-100">{user.name}</p>
            <p className="text-[11px] text-slate-500">{user.email}</p>
          </div>
        )}

        <AlertDropdown />

        <LanguageSelect />

        <button
          onClick={() => {
            const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
            document.documentElement.classList.toggle('light', next === 'light');
            localStorage.setItem('twcs.theme', next);
          }}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          aria-label={t.topbar.toggleTheme}
          title={t.topbar.toggleTheme}
        >
          <Sun className="theme-icon-sun h-4 w-4" />
          <Moon className="theme-icon-moon h-4 w-4" />
        </button>

        <button
          onClick={logout}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          aria-label={t.topbar.logOut}
          title={t.topbar.logOut}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
