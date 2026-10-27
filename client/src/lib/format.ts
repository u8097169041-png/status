import { ApiError } from '../api/client';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function relativeTime(iso: string, locale: string, justNow: string, now = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 45) return justNow;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  for (const [unit, size] of UNITS) {
    if (abs >= size || unit === 'minute') return rtf.format(Math.round(seconds / size), unit);
  }
  return justNow;
}

export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatUsd(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 0.01 ? 5 : 4,
  }).format(value);
}

/** Preis pro Token → Preis pro 1 Mio. Tokens. */
export function perMillion(price: number | null, locale: string): string {
  if (price === null) return '?';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(price * 1_000_000);
}

export function durationUntil(iso: string, locale: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((new Date(iso).getTime() - now) / 60000));
  if (minutes >= 60) {
    return new Intl.NumberFormat(locale, { style: 'unit', unit: 'hour', unitDisplay: 'short' }).format(Math.round(minutes / 60));
  }
  return new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'short' }).format(minutes);
}

/** Wandelt Fehler in eine lokalisierte, verständliche Meldung um. */
export function errorMessage(error: unknown, td: (key: string, fallback?: string) => string): string {
  if (error instanceof ApiError) {
    if (error.code === 'network') return td('errors.network');
    const known = td(`errors.${error.code}`, '');
    if (known) return known;
    return error.message || td('errors.generic');
  }
  return td('errors.generic');
}
