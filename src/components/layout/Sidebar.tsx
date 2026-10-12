'use client';

import clsx from 'clsx';
import {
  CalendarClock,
  FileBarChart,
  Database,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  Layers,
  Leaf,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import logo from '@/images/logo.jpeg';

const NAV: { href: string; label: string; icon: LucideIcon; iconClass: string }[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, iconClass: 'bg-sky-500/20 text-sky-400' },
  { href: '/dashboard-2', label: 'Live Monitoring', icon: LineChart, iconClass: 'bg-lime-500/20 text-lime-400' },
  { href: '/simulator', label: 'Simulator', icon: FlaskConical, iconClass: 'bg-purple-500/20 text-purple-400' },
  { href: '/troughs', label: 'Troughs', icon: Layers, iconClass: 'bg-teal-500/20 text-teal-400' },
  { href: '/batches', label: 'Batches', icon: Leaf, iconClass: 'bg-emerald-500/20 text-emerald-400' },
  { href: '/schedules', label: 'Schedules', icon: CalendarClock, iconClass: 'bg-amber-500/20 text-amber-400' },
  { href: '/reports', label: 'Reports', icon: FileBarChart, iconClass: 'bg-violet-500/20 text-violet-400' },
  { href: '/settings', label: 'Settings', icon: Settings, iconClass: 'bg-indigo-500/20 text-indigo-400' },
  { href: '/users', label: 'Users', icon: Users, iconClass: 'bg-rose-500/20 text-rose-400' },
  { href: '/master-data', label: 'Master Data Dev', icon: Database, iconClass: 'bg-cyan-500/20 text-cyan-400' },
];

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <aside
      className={clsx(
        /* 12 px gap from every viewport edge — the sidebar floats */
        'fixed bottom-3 left-3 top-3 z-40 flex w-56 flex-col transition-transform lg:translate-x-0',
        'glass rounded-2xl',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Logo */}
      <div className="px-2.5 pt-2.5 pb-2">
        <div className="overflow-hidden rounded-xl bg-white/90 shadow-sm ring-1 ring-black/5">
          <Image
            src={logo}
            alt="TWCS — Tea Withering Control System"
            priority
            sizes="200px"
            className="h-auto w-full"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2 pt-1">
        {NAV.map(({ href, label, icon: Icon, iconClass }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={clsx(
                'group relative flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] leading-snug transition-colors duration-150',
                active
                  ? 'bg-white/95 font-semibold text-[#111827] shadow-sm ring-1 ring-black/5'
                  : 'font-medium text-[#111827]/70 hover:bg-white/25 hover:text-[#111827]',
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-tea-600"
                />
              )}
              <span
                className={clsx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-transform duration-150',
                  iconClass,
                  !active && 'group-hover:scale-105',
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 px-3 py-2.5 text-[10px] font-medium tracking-wide text-[#111827]/40">
        TWCS v0.1.0
      </div>
    </aside>
  );
}
