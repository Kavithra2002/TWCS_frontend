'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  CalendarClock,
  FileBarChart,
  LayoutDashboard,
  Layers,
  Leaf,
  Settings,
  type LucideIcon,
} from 'lucide-react';

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/troughs', label: 'Troughs', icon: Layers },
  { href: '/batches', label: 'Batches', icon: Leaf },
  { href: '/schedules', label: 'Schedules', icon: CalendarClock },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/reports', label: 'Reports', icon: FileBarChart },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-800 bg-slate-950 transition-transform lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tea-600">
          <Leaf className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-wide text-slate-50">TWCS</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Withering Control</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
              isActive(href)
                ? 'bg-tea-600/15 text-tea-300'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4 text-[11px] text-slate-600">TWCS v0.1.0</div>
    </aside>
  );
}
