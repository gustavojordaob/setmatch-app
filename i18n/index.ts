import { enUS } from './locales/en-US';
import { es } from './locales/es';
import { ptBR } from './locales/pt-BR';
import type { AppLocale, TranslationDict, TranslateFn } from './types';

export * from './types';

const DICTS: Record<AppLocale, TranslationDict> = {
  'pt-BR': ptBR,
  'en-US': enUS,
  es,
};

export const LOCALE_LABEL_KEYS: Record<AppLocale, string> = {
  'pt-BR': 'language.ptBR',
  'en-US': 'language.enUS',
  es: 'language.es',
};

export function createTranslator(locale: AppLocale): TranslateFn {
  const dict = DICTS[locale] ?? ptBR;
  const fallback = ptBR;

  return (key, params) => {
    let text = dict[key] ?? fallback[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      }
    }
    return text;
  };
}

export function isAppLocale(v: string | null | undefined): v is AppLocale {
  return v === 'pt-BR' || v === 'en-US' || v === 'es';
}
