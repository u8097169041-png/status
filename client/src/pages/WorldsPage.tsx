import { Globe2, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { useWorlds } from '../api/hooks';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/States';
import { WorldCard } from '../components/worlds/WorldCard';
import { useI18n } from '../i18n';

export function WorldsPage() {
  const { t } = useI18n();
  const worlds = useWorlds();
  const custom = worlds.data?.filter((w) => w.isCustom) ?? [];
  const presets = worlds.data?.filter((w) => !w.isCustom) ?? [];
  return (
    <div className="page">
      <header className="page-header">
        <div className="titles">
          <h1>{t('worlds.title')}</h1>
          <p>{t('worlds.subtitle')}</p>
        </div>
        <div className="actions">
          <Link to="/worlds/new" className="btn btn-primary">
            <Plus aria-hidden /> {t('worlds.create')}
          </Link>
        </div>
      </header>
      {worlds.isPending && <SkeletonList count={2} height={240} />}
      {worlds.isError && <ErrorState error={worlds.error} onRetry={() => void worlds.refetch()} />}
      {worlds.data && (
        <div className="stack">
          {custom.length > 0 && (
            <section className="section">
              <h2>{t('worlds.yours')}</h2>
              <div className="grid-cards">
                {custom.map((w) => (
                  <WorldCard key={w.id} world={w} />
                ))}
              </div>
            </section>
          )}
          <section className="section">
            <h2>{t('worlds.presets')}</h2>
            {presets.length === 0 ? (
              <EmptyState icon={Globe2} title={t('worlds.noEvents')} />
            ) : (
              <div className="grid-cards">
                {presets.map((w) => (
                  <WorldCard key={w.id} world={w} />
                ))}
                <Link to="/worlds/new" className="create-tile card-interactive">
                  <Plus aria-hidden />
                  <strong>{t('discover.createWorld')}</strong>
                  <span className="small muted">{t('discover.createWorldHint')}</span>
                </Link>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
