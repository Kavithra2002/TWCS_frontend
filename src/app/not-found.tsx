import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <p className="text-5xl font-bold text-slate-500">404</p>
      <p className="text-slate-300">Page not found</p>
      <Link href="/" className="text-sm text-tea-400 hover:text-tea-300">
        Back to dashboard
      </Link>
    </main>
  );
}
