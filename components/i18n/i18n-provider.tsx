"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { dictionaries, type Locale } from "../../lib/i18n/dictionaries";
import { localeChangeEvent, localeStorageKey, publishLocale, readLocaleCookie, writeLocaleCookie } from "../../lib/i18n/locale";

type I18nContextValue = { locale: Locale; setLocale: (locale: Locale) => void; dictionary: (typeof dictionaries)[Locale] };
const I18nContext = createContext<I18nContextValue | null>(null);

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(localeChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(localeChangeEvent, onStoreChange);
  };
}

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  // Keep the server render and the first browser render on the same locale.
  // A hardcoded English server snapshot made every page fetch twice.
  const locale = useSyncExternalStore(
    subscribe,
    () => readLocaleCookie() ?? initialLocale,
    () => initialLocale,
  );

  const setLocale = useCallback((nextLocale: Locale) => { publishLocale(nextLocale); }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      if (localStorage.getItem(localeStorageKey) !== locale) localStorage.setItem(localeStorageKey, locale);
    } catch { /* Private mode can block storage. */ }
    if (readLocaleCookie() !== locale) writeLocaleCookie(locale);
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, dictionary: dictionaries[locale] }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
