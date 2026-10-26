'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { LANGUAGE_STORAGE_KEY, isLang, messages, type Lang, type Messages } from '@/lib/i18n';

interface LanguageState {
  lang: Lang;
  t: Messages;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageState>({
  lang: 'en',
  t: messages.en,
  setLang: () => {},
});

function applyLang(lang: Lang) {
  document.documentElement.lang = lang;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isLang(stored)) setLangState(stored);
    } catch {
      /* storage unavailable */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyLang(lang);
  }, [lang, ready]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    applyLang(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  if (!ready) return <div className="min-h-screen" suppressHydrationWarning />;

  return (
    <LanguageContext.Provider value={{ lang, t: messages[lang], setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
