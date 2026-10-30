'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessPath, homePathFor } from '@/lib/auth';
import { useAuth } from '@/components/providers/AuthProvider';

/** Sends a signed-in account back to their home page when they open a restricted route. */
export function RoleGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = canAccessPath(user, pathname);

  useEffect(() => {
    if (allowed) return;
    const next = homePathFor(user);
    if (next !== pathname) router.replace(next);
  }, [allowed, pathname, router, user]);

  if (!allowed) return <div className="min-h-[40vh]" />;

  return <>{children}</>;
}
