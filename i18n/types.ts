export type AppLocale = 'pt-BR' | 'en-US' | 'es';

export const APP_LOCALES: AppLocale[] = ['pt-BR', 'en-US', 'es'];

export const LOCALE_STORAGE_KEY = '@setmatch/locale';

export type TranslationDict = Record<string, string>;

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;
