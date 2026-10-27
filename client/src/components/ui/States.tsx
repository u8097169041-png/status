import { AlertTriangle, Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { errorMessage } from '../../lib/format';

export function EmptyState({
  icon: Icon = Inbox,
  title,
  text,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="icon">
        <Icon aria-hidden />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t, td } = useI18n();
  return (
    <div className="error-state" role="alert">
      <div className="icon">
        <AlertTriangle aria-hidden />
      </div>
      <h3>{t('errors.loadFailed')}</h3>
      <p>{errorMessage(error, td)}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="loading-center" role="status">
      <span className="row">
        <span className="spinner" aria-hidden /> {label ?? t('common.loading')}
      </span>
    </div>
  );
}

export function SkeletonList({ count = 3, height = 140 }: { count?: number; height?: number }) {
  return (
    <div className="stack" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton skeleton-card" style={{ height }} />
      ))}
    </div>
  );
}
