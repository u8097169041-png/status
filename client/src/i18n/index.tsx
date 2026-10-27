import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { Lang } from '../../../shared/constants';
import { de, type Dictionary } from './de';
import { en } from './en';

const DICTIONARIES: Record<Lang, Dictionary> = { de, en };

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<Dictionary>;
export type TVars = Record<string, string | number>;

function lookup(dict: Dictionary, key: string): string | undefined {
  const dot = key.indexOf('.');
  if (dot < 0) return undefined;
  const section = (dict as unknown as Record<string, Record<string, string>>)[key.slice(0, dot)];
  return section?.[key.slice(dot + 1)];
}

function interpolate(text: string, vars?: TVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function translate(lang: Lang, key: string, vars?: TVars): string {
  const text = lookup(DICTIONARIES[lang], key) ?? lookup(DICTIONARIES.de, key);
  return text === undefined ? key : interpolate(text, vars);
}

export function hasKey(lang: Lang, key: string): boolean {
  return lookup(DICTIONARIES[lang], key) !== undefined;
}

interface I18nValue {
  lang: Lang;
  /** Typgeprüfte Übersetzung. */
  t: (key: TKey, vars?: TVars) => string;
  /** Dynamischer Schlüssel (z. B. aus Server-Daten) mit Rückfallwert. */
  td: (key: string, fallback?: string, vars?: TVars) => string;
  locale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t = useCallback((key: TKey, vars?: TVars) => translate(lang, key, vars), [lang]);
  const td = useCallback(
    (key: string, fallback?: string, vars?: TVars) =>
      hasKey(lang, key) || hasKey('de', key) ? translate(lang, key, vars) : (fallback ?? key),
    [lang],
  );
  const value = useMemo(() => ({ lang, t, td, locale: lang === 'de' ? 'de-DE' : 'en-GB' }), [lang, t, td]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n muss innerhalb von I18nProvider verwendet werden.');
  return ctx;
}

export { DICTIONARIES };
