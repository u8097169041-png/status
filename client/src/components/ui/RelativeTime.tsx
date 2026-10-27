import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { formatDateTime, relativeTime } from '../../lib/format';

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

/** Ein gemeinsamer Minutentakt für alle relativen Zeitangaben. */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    listeners.add(update);
    if (!timer) timer = setInterval(() => listeners.forEach((l) => l()), 60_000);
    return () => {
      listeners.delete(update);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
}

export function RelativeTime({ iso }: { iso: string }) {
  const { locale, t } = useI18n();
  useMinuteTick();
  return (
    <time dateTime={iso} title={formatDateTime(iso, locale)}>
      {relativeTime(iso, locale, t('time.justNow'))}
    </time>
  );
}
