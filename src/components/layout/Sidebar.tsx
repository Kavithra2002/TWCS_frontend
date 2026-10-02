'use client';

import clsx from 'clsx';
import {
  Bell,
  CalendarClock,
  FileBarChart,
  LayoutDashboard,
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
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, iconClass: 'bg-sky-500/15 text-sky-400' },
  { href: '/troughs', label: 'Troughs', icon: Layers, iconClass: 'bg-teal-500/15 text-teal-400' },
  { href: '/batches', label: 'Batches', icon: Leaf, iconClass: 'bg-emerald-500/15 text-emerald-400' },
  { href: '/schedules', label: 'Schedules', icon: CalendarClock, iconClass: 'bg-amber-500/15 text-amber-400' },
  { href: '/alerts', label: 'Alerts', icon: Bell, iconClass: 'bg-red-500/15 text-red-400' },
  { href: '/reports', label: 'Reports', icon: FileBarChart, iconClass: 'bg-violet-500/15 text-violet-400' },
  { href: '/settings', label: 'Settings', icon: Settings, iconClass: 'bg-indigo-500/15 text-indigo-400' },
  { href: '/users', label: 'Users', icon: Users, iconClass: 'bg-rose-500/15 text-rose-400' },
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
      <div className="border-b border-slate-800 px-3 py-3">
        <Image
          src={logo}
          alt="TWCS — Tea Withering Control System"
          priority
          sizes="216px"
          className="h-auto w-full rounded-md bg-white"
        />
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.map(({ href, label, icon: Icon, iconClass }) => (
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
            <span className={clsx('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', iconClass)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4 text-[11px] text-slate-600">TWCS v0.1.0</div>
    </aside>
  );
}
