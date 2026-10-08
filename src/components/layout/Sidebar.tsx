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
        'fixed bottom-3 left-3 top-3 z-40 flex w-60 flex-col transition-transform lg:translate-x-0',
        'glass rounded-2xl',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Logo */}
      <div className="border-b border-black/10 px-3 py-3">
        <Image
          src={logo}
          alt="TWCS — Tea Withering Control System"
          priority
          sizes="216px"
          className="h-auto w-full rounded-md"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map(({ href, label, icon: Icon, iconClass }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={clsx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
              isActive(href)
                ? 'bg-white font-bold text-[#111827] shadow-[0_2px_8px_rgba(0,0,0,0.18)]'
                : 'font-medium text-[#111827] hover:bg-white/20',
            )}
          >
            <span className={clsx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', iconClass)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="shrink-0 border-t border-black/10 px-4 py-3 text-[11px] text-[#111827]/50">TWCS v0.1.0</div>
    </aside>
  );
}
