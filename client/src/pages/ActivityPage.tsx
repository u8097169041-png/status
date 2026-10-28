import { Bell, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useActivity, useMarkNotificationsRead } from '../api/hooks';
import { useActivePlay } from '../components/play/PlayUI';
import { Tabs } from '../components/ui/Form';
import { RelativeTime } from '../components/ui/RelativeTime';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/States';
import { EventTimeline } from '../components/worlds/EventTimeline';
import { useI18n } from '../i18n';
import { NotificationList } from './NotificationsPage';

type Tab = 'notifications' | 'events' | 'decisions';

/** Aktivität: Mitteilungen, Weltgeschehen und getroffene Entscheidungen der aktiven Welt. */
export function ActivityPage() {
  const { t } = useI18n();
  const { boot, worldId, world } = useActivePlay();
  const activity = useActivity(worldId);
  const markRead = useMarkNotificationsRead();
  const [tab, setTab] = useState<Tab>('notifications');
  const data = activity.data;

  return (
    <div className="page page-narrow">
      <header className="page-header">
        <div className="titles">
          <h1>{t('activity.title')}</h1>
          <p>
            {t('activity.subtitle')}
            {world ? ` · ${world.name}` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => markRead.mutate()} disabled={!boot?.unreadNotifications}>
          <CheckCheck aria-hidden /> {t('notifications.markAllRead')}
        </button>
      </header>
      <Tabs<Tab>
        label={t('activity.title')}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'notifications', label: t('activity.tabNotifications'), count: boot?.unreadNotifications || undefined },
          ...(worldId
            ? [
                { id: 'events' as const, label: t('activity.tabEvents') },
                { id: 'decisions' as const, label: t('activity.tabDecisions'), count: data?.decisions.length },
              ]
            : []),
        ]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="stack">
        {activity.isPending && <SkeletonList count={4} height={64} />}
        {activity.isError && <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />}
        {data && tab === 'notifications' &&
          (data.notifications.length === 0 ? <EmptyState icon={Bell} title={t('notifications.empty')} /> : <NotificationList items={data.notifications} />)}
        {data && tab === 'events' &&
          (data.events.length === 0 ? (
            <EmptyState title={t('activity.empty')} />
          ) : (
            <div className="card">
              <EventTimeline events={data.events} reactable />
            </div>
          ))}
        {data && tab === 'decisions' &&
          (data.decisions.length === 0 ? (
            <EmptyState title={t('tasks.historyEmpty')} />
          ) : (
            <ul className="decision-history">
              {data.decisions.map((d) => (
                <li key={d.id} className="card card-tight">
                  <div className="row-between">
                    <strong className="small">{d.title}</strong>
                    {d.resolvedAt && (
                      <span className="xsmall faint">
                        <RelativeTime iso={d.resolvedAt} />
                      </span>
                    )}
                  </div>
                  <p className="xsmall accent">{t('tasks.chosen', { option: d.options.find((o) => o.id === d.chosenOptionId)?.label ?? '' })}</p>
                  {d.outcome && <p className="small muted">{d.outcome}</p>}
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}
