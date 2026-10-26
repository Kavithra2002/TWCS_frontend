'use client';

import clsx from 'clsx';
import { LANGUAGES, type Lang } from '@/lib/i18n';
import { useLanguage } from '@/components/providers/LanguageProvider';

export function LanguageSelect({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { lang, setLang, t } = useLanguage();

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t.topbar.language}</span>
      <select
        value={lang}
        onChange={(event) => setLang(event.target.value as Lang)}
        aria-label={t.topbar.language}
        className={clsx(
          'h-8 cursor-pointer appearance-none rounded-xl border bg-transparent py-0 pl-2.5 pr-7 text-xs font-medium outline-none transition',
          tone === 'dark'
            ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
            : 'border-[#e6e6e6] bg-white text-[#1c1c1c] hover:border-[#d0d0d0]',
        )}
      >
        {LANGUAGES.map((language) => (
          <option key={language.id} value={language.id}>
            {language.native}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className={clsx(
          'pointer-events-none absolute right-2 text-[9px]',
          tone === 'dark' ? 'text-slate-400' : 'text-[#8a8a8a]',
        )}
      >
        ▾
      </span>
    </label>
  );
}
