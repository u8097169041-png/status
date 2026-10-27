import { Bell, BookOpen, CheckCheck, Heart, MessageCircle, PartyPopper, Reply, Trophy, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import type { NotificationDto } from '../../../shared/types';
import { useMarkNotificationsRead, useNotifications } from '../api/hooks';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/States';
import { RelativeTime } from '../components/ui/RelativeTime';
import { useI18n } from '../i18n';

const ICONS: Record<string, LucideIcon> = {
  welcome: PartyPopper,
  levelUp: Trophy,
  achievement: Trophy,
  postReaction: Heart,
  postComment: MessageCircle,
  commentReply: Reply,
  storylineResolved: BookOpen,
};

function useNotificationText() {
  const { td } = useI18n();
  return (n: NotificationDto) => {
    const params = { ...n.params };
    if (n.kind === 'achievement' && typeof params.id === 'string') params.name = td(`achievements.${params.id}`, params.id);
    return td(`notifications.${n.kind}`, n.kind, params);
  };
}

export function NotificationsPage() {
  const { t } = useI18n();
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();
  const text = useNotificationText();
  return (
    <div className="page page-narrow">
      <header className="page-header">
        <h1>{t('notifications.title')}</h1>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => markRead.mutate()} disabled={!notifications.data?.unread}>
          <CheckCheck aria-hidden /> {t('notifications.markAllRead')}
        </button>
      </header>
      {notifications.isPending && <SkeletonList count={4} height={64} />}
      {notifications.isError && <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />}
      {notifications.data &&
        (notifications.data.items.length === 0 ? (
          <EmptyState icon={Bell} title={t('notifications.empty')} />
        ) : (
          <ul className="notification-list">
            {notifications.data.items.map((n) => {
              const Icon = ICONS[n.kind] ?? Bell;
              const body = (
                <>
                  <span className="notification-icon" aria-hidden>
                    <Icon />
                  </span>
                  <span className="grow small">{text(n)}</span>
                  <span className="xsmall faint">
                    <RelativeTime iso={n.createdAt} />
                  </span>
                  {!n.read && <span className="unread-dot" aria-label={t('notifications.unread')} />}
                </>
              );
              return (
                <li key={n.id} className={`notification ${n.read ? '' : 'unread'}`}>
                  {n.link ? (
                    <Link to={n.link} className="notification-row">
                      {body}
                    </Link>
                  ) : (
                    <div className="notification-row">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
