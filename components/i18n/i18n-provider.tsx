"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { dictionaries, supportedLocales, type Locale } from "../../lib/i18n/dictionaries";

type I18nContextValue = { locale: Locale; setLocale: (locale: Locale) => void; dictionary: (typeof dictionaries)[Locale] };
const I18nContext = createContext<I18nContextValue | null>(null);
const storageKey = "qualityfriend-locale";
const localeChangeEvent = "qualityfriend-locale-change";

function isLocale(value: string | null): value is Locale {
  return value !== null && supportedLocales.some((locale) => locale === value);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore<Locale>(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener(localeChangeEvent, onStoreChange);
      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(localeChangeEvent, onStoreChange);
      };
    },
    () => {
    const saved = window.localStorage.getItem(storageKey);
    const browserLocale = window.navigator.language.slice(0, 2);
      return isLocale(saved) ? saved : isLocale(browserLocale) ? browserLocale : "en";
    },
    () => "en",
  );

  const setLocale = (nextLocale: Locale) => {
    window.localStorage.setItem(storageKey, nextLocale);
    window.dispatchEvent(new Event(localeChangeEvent));
    document.documentElement.lang = nextLocale;
  };

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, dictionary: dictionaries[locale] }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
