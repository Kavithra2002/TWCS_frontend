'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessPath } from '@/lib/auth';
import { useAuth } from '@/components/providers/AuthProvider';

/** Sends overview-only roles back to `/` when they open a restricted route. */
export function RoleGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = canAccessPath(user, pathname);

  useEffect(() => {
    if (!allowed) router.replace('/');
  }, [allowed, router]);

  if (!allowed) return <div className="min-h-[40vh]" />;

  return <>{children}</>;
}
