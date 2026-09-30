'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Login is disabled for now. Send anyone who lands here to the dashboard. */
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}
