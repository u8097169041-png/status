import { useId } from 'react';

export function BrandMark() {
  // Eindeutige ID je Instanz: Das Logo erscheint mehrfach (Seitenleiste, Kopfzeile).
  const gradientId = `brand-g-${useId().replace(/:/g, '')}`;
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9a8cff" />
          <stop offset="1" stopColor="#3ee0d0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#151829" />
      <circle cx="32" cy="32" r="16" fill="none" stroke={`url(#${gradientId})`} strokeWidth="5" />
      <ellipse cx="32" cy="32" rx="26" ry="9" fill="none" stroke={`url(#${gradientId})`} strokeWidth="3" transform="rotate(-25 32 32)" opacity=".85" />
      <circle cx="47" cy="22" r="4" fill="#3ee0d0" />
    </svg>
  );
}
