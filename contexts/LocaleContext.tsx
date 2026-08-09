import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APP_LOCALES,
  createTranslator,
  isAppLocale,
  LOCALE_STORAGE_KEY,
  type AppLocale,
  type TranslateFn,
} from '../i18n';

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: TranslateFn;
  ready: boolean;
  locales: AppLocale[];
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('pt-BR');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
        if (isAppLocale(saved)) setLocaleState(saved);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    void AsyncStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t, ready, locales: APP_LOCALES }),
    [locale, setLocale, t, ready]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

/** Atalho — mesmo que useLocale().t */
export function useT(): TranslateFn {
  return useLocale().t;
}
