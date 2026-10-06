'use client';

import clsx from 'clsx';
import { Eye, EyeOff, Mail } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import estate from '@/images/4f3265e534371093b0b8717c1a9dd035.jpg';
import logo from '@/images/logo.jpeg';
import { ApiError, api } from '@/lib/api';
import { setSession } from '@/lib/auth';
import type { User } from '@/types';

const REMEMBER_KEY = 'twcs.login.email';

export default function LoginPage() {
  useEffect(() => {
    const root = document.documentElement;
    const previousBody = document.body.style.overflow;
    const previousRoot = root.style.overflow;
    document.body.style.overflow = 'hidden';
    root.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBody;
      root.style.overflow = previousRoot;
    };
  }, []);

  return (
    <main className="relative h-dvh overflow-hidden bg-[#0d3b2c] text-[#1a1a1a]" style={{ colorScheme: 'light' }}>
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <img src="/login-brush.svg" alt="" className="h-full w-full object-cover" />
      </div>
      <div className="relative flex h-full items-center justify-center px-6">
        <div className="grid w-full max-w-[810px] overflow-hidden rounded-[28px] bg-white p-2.5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)] sm:grid-cols-2">
          <div className="flex items-center justify-center px-6 py-8 sm:px-8">
            <SignInForm />
          </div>
          <div className="relative hidden overflow-hidden rounded-[22px] sm:block">
            <Image
              src={estate}
              alt="Tea fields on a misty hillside"
              fill
              priority
              sizes="400px"
              className="object-cover object-[center_38%]"
            />
          </div>
        </div>
      </div>

    </main>
  );
}

function SignInForm() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const resetEmailId = useId();
  const rememberId = useId();
  const [mode, setMode] = useState<'sign-in' | 'reset'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [sessionExpired, setSessionExpired] = useState(false);
  const [resetNote, setResetNote] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      /* storage unavailable */
    }
    setSessionExpired(new URLSearchParams(window.location.search).get('expired') === '1');
  }, []);

  function validateEmail(value: string) {
    if (!value.trim()) return 'Enter your email.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address.';
    return '';
  }

  async function onSignIn(event: FormEvent) {
    event.preventDefault();
    const next = {
      email: validateEmail(email),
      password: password ? '' : 'Enter your password.',
    };
    setErrors(next);
    if (next.email || next.password) return;

    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* storage unavailable */
    }

    setSubmitting(true);
    try {
      const result = await api<{ token: string; user: User }>(
        '/auth/login',
        { method: 'POST', json: { email: email.trim(), password, remember }, live: true },
      );
      setSession(result.token, result.user);
      router.push('/');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not sign in. Check that the API is running.';
      setErrors({ form: message });
      setSubmitting(false);
    }
  }

  function onReset(event: FormEvent) {
    event.preventDefault();
    const emailError = validateEmail(email);
    setErrors({ email: emailError });
    setResetNote('');
    if (emailError) return;
    setResetNote('Password reset is not available yet.');
  }

  if (mode === 'reset') {
    return (
      <div className="w-full">
        <h1 className="text-center font-welcome text-[1.35rem] font-medium tracking-tight text-[#1c1c1c]">Reset password</h1>
        <p className="mt-2 text-center text-sm text-[#8d8d8d]">Enter the work email on your TWCS account.</p>
        <form className="mt-4" onSubmit={onReset} noValidate>
          <label htmlFor={resetEmailId} className="sr-only">
            Email
          </label>
          <div className="relative">
            <input
              id={resetEmailId}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors({});
                setResetNote('');
              }}
              placeholder="Email"
              className={clsx(fieldClass(!!errors.email), 'pr-12')}
            />
            <Mail className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b0b0b0]" />
          </div>
          {errors.email && <FieldError>{errors.email}</FieldError>}
          {resetNote && (
            <p className="mt-3 text-center text-sm text-[#8d8d8d]" role="status">
              {resetNote}
            </p>
          )}
          <button type="submit" className={primaryButtonClass}>
            Send reset link
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode('sign-in');
            setErrors({});
            setResetNote('');
          }}
          className="mt-5 w-full text-center text-sm text-[#8d8d8d] hover:text-[#1c1c1c]"
        >
          Back to log in
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Image src={logo} alt="TWCS" priority className="mx-auto mb-4 h-auto w-[150px]" />
      <h1 className="text-center font-welcome text-[2rem] font-medium leading-none tracking-tight text-[#1c1c1c]">
        Welcome back
      </h1>
      <p className="mt-2 text-center text-sm text-[#6b6b6b]">Please enter your details.</p>
      {sessionExpired && (
        <p className="mt-4 text-center text-sm leading-relaxed text-[#b42318]" role="alert">
          Your session expired. Log in again to continue.
        </p>
      )}

      <form className="mt-6" onSubmit={onSignIn} noValidate>
        <div>
          <label htmlFor={emailId} className="mb-1.5 block text-sm font-medium text-[#24382c]">
            Email
          </label>
          <div className="relative">
            <input
              id={emailId}
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              spellCheck={false}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, email: undefined, form: undefined }));
              }}
              placeholder="name@factory.com"
              className={clsx(fieldClass(!!errors.email), 'pr-11')}
            />
            <Mail className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8a8a]" />
          </div>
          {errors.email && <FieldError>{errors.email}</FieldError>}
        </div>

        <div className="mt-4">
          <label htmlFor={passwordId} className="mb-1.5 block text-sm font-medium text-[#24382c]">
            Password
          </label>
          <div className="relative">
            <input
              id={passwordId}
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({ ...current, password: undefined, form: undefined }));
              }}
              placeholder="Enter your password"
              className={clsx(fieldClass(!!errors.password), 'pr-11')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#8a8a8a] hover:text-[#1c1c1c]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <FieldError>{errors.password}</FieldError>}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#5c5c5c]">
          <label htmlFor={rememberId} className="flex items-center gap-2">
            <input
              id={rememberId}
              name="remember"
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-[#c8c8c8] text-[#f5a524] focus:ring-[#f5a524]"
            />
            Remember for 30 days
          </label>
          <button
            type="button"
            onClick={() => {
              setMode('reset');
              setErrors({});
            }}
            className="shrink-0 font-medium text-[#1a6b40] hover:underline"
          >
            Forgot password?
          </button>
        </div>

        {errors.form && (
          <p className="mt-4 text-center text-sm leading-relaxed text-[#b42318]" role="alert">
            {errors.form}
          </p>
        )}

        <button type="submit" className={primaryButtonClass} disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}

function FieldError({ children }: { children: string }) {
  return (
    <p className="mt-1.5 px-4 text-left text-xs text-[#b42318]" role="alert">
      {children}
    </p>
  );
}

const fieldClass = (invalid: boolean) =>
  clsx(
    'h-11 w-full rounded-full border bg-white px-4 text-sm text-[#1c1c1c] outline-none transition placeholder:text-[#9a9a9a] focus:ring-2',
    invalid
      ? 'border-[#d92d20] focus:border-[#d92d20] focus:ring-[#d92d20]/20'
      : 'border-[#e6e6e6] focus:border-[#f5a524] focus:ring-[#f5a524]/25',
  );

const primaryButtonClass =
  'mt-5 flex h-11 w-full items-center justify-center rounded-full bg-[#f5a524] text-sm font-semibold text-white transition hover:bg-[#e09412] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5a524] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70';
