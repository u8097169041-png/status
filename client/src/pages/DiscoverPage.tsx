import { ArrowRight, Flame, GitBranch, Globe2, Plus, Search, Sparkles, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { WORLD_CATEGORIES, type WorldCategory } from '../../../shared/constants';
import type { WorldSummary } from '../../../shared/types';
import { useBootstrap, useDiscover, usePlayActions } from '../api/hooks';
import { CharacterCard } from '../components/characters/CharacterCard';
import { useErrorToast } from '../components/progress/useProgressFeedback';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/States';
import { ArcCard } from '../components/worlds/ArcCard';
import { WorldCard } from '../components/worlds/WorldCard';
import { useI18n } from '../i18n';

type Filter = WorldCategory | 'all' | 'custom';

function CreateWorldCard() {
  const { t } = useI18n();
  return (
    <Link to="/worlds/new" className="create-world-card">
      <span className="create-world-icon" aria-hidden>
        <Plus />
      </span>
      <strong>{t('discover.createCta')}</strong>
      <span className="small">{t('discover.createCtaText')}</span>
    </Link>
  );
}

function WorldRow({ id, title, icon: Icon, worlds }: { id: string; title: string; icon: typeof Globe2; worlds: WorldSummary[] }) {
  if (worlds.length === 0) return null;
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-header">
        <h2 id={id} className="row">
          <Icon aria-hidden className="icon-sm accent" /> {title}
        </h2>
      </div>
      <div className="h-scroll world-row">
        {worlds.map((w) => (
          <WorldCard key={w.id} world={w} />
        ))}
      </div>
    </section>
  );
}

/**
 * Startseite und Weltauswahl. Vor dem Beitritt gibt es hier nur Entdeckung: Welten, Figuren und Handlungsbögen.
 * Stories, Posts, Quests und weltinterne Ereignisse erscheinen erst nach dem Beitritt in der jeweiligen Welt.
 */
export function DiscoverPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const discover = useDiscover();
  const { data: boot } = useBootstrap();
  const play = usePlayActions();
  const showError = useErrorToast();
  const [filter, setFilter] = useState<Filter>('all');

  const worlds = useMemo(() => discover.data?.worlds ?? [], [discover.data]);
  const categories = useMemo(() => WORLD_CATEGORIES.filter((c) => worlds.some((w) => w.category === c && !w.isCustom)), [worlds]);
  const own = worlds.filter((w) => w.isCustom);
  const filtered = filter === 'all' ? worlds : filter === 'custom' ? own : worlds.filter((w) => w.category === filter && !w.isCustom);
  const joined = boot?.joinedWorlds ?? [];

  return (
    <div className="page discover-page">
      <header className="discover-hero">
        <h1>{t('discover.greeting')}</h1>
        <p className="muted">{t('discover.greetingText')}</p>
        <Link to="/search" className="search-launcher">
          <Search aria-hidden /> <span>{t('discover.searchPlaceholder')}</span>
        </Link>
      </header>

      <div className="chip-row scroll category-chips" role="group" aria-label={t('discover.categoryFilter')}>
        <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          {t('discover.allCategories')}
        </button>
        {categories.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={filter === c} onClick={() => setFilter(c)}>
            {t(`categories.${c}`)}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={filter === 'custom'} onClick={() => setFilter('custom')}>
          {t('categories.custom')}
        </button>
      </div>

      {discover.isPending && <SkeletonList count={2} height={260} />}
      {discover.isError && <ErrorState error={discover.error} onRetry={() => void discover.refetch()} />}

      {discover.data && filter !== 'all' && (
        <section className="section" aria-label={filter === 'custom' ? t('categories.custom') : t(`categories.${filter}`)}>
          {filtered.length === 0 && filter !== 'custom' && <p className="muted small">{t('discover.noWorldsInCategory')}</p>}
          {filtered.length === 0 && filter === 'custom' && <p className="muted small">{t('discover.ownWorldsEmpty')}</p>}
          <div className="world-grid">
            {filtered.map((w) => (
              <WorldCard key={w.id} world={w} />
            ))}
            {filter === 'custom' && <CreateWorldCard />}
          </div>
        </section>
      )}

      {discover.data && filter === 'all' && (
        <div className="stack discover">
          {joined.length > 0 && (
            <section className="section" aria-labelledby="your-worlds">
              <div className="section-header">
                <h2 id="your-worlds" className="row">
                  <Globe2 aria-hidden className="icon-sm accent" /> {t('discover.yourWorlds')}
                </h2>
              </div>
              <ul className="joined-worlds">
                {joined.map(({ world, player }) => (
                  <li key={world.id} className="card card-tight joined-world" style={{ '--world-hue': world.hue } as React.CSSProperties}>
                    <Avatar name={player.character.name} hue={player.character.avatarHue} glyph={player.character.avatarGlyph} size="md" decorative />
                    <span className="grow min-w-0">
                      <strong className="block truncate">{world.name}</strong>
                      <span className="xsmall muted block truncate">
                        {t('play.playingAs', { name: player.character.name })} · {t('play.level', { level: player.level.level })}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={play.setWorld.isPending}
                      aria-label={`${t('discover.continue')}: ${world.name}`}
                      onClick={() => play.setWorld.mutate(world.id, { onSuccess: () => navigate('/feed'), onError: showError })}
                    >
                      {t('discover.continue')} <ArrowRight aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <WorldRow id="popular-worlds" title={t('discover.popular')} icon={Flame} worlds={discover.data.popular} />

          {discover.data.scenarios.length > 0 && (
            <section className="section" aria-labelledby="discover-arcs">
              <div className="section-header">
                <h2 id="discover-arcs" className="row">
                  <GitBranch aria-hidden className="icon-sm accent" /> {t('discover.arcs')}
                </h2>
              </div>
              <p className="small muted">{t('discover.arcsHint')}</p>
              <div className="h-scroll">
                {discover.data.scenarios.map((s) => (
                  <ArcCard key={s.id} arc={s} />
                ))}
              </div>
            </section>
          )}

          {/* Kategorien mit mehreren Welten als eigene Reihe, der Rest gesammelt. */}
          {categories
            .filter((c) => worlds.filter((w) => w.category === c && !w.isCustom).length >= 2)
            .map((c) => (
              <WorldRow
                key={c}
                id={`category-${c}`}
                title={t(`categories.${c}`)}
                icon={Sparkles}
                worlds={worlds.filter((w) => w.category === c && !w.isCustom)}
              />
            ))}
          <WorldRow
            id="category-more"
            title={t('discover.moreWorlds')}
            icon={Sparkles}
            worlds={worlds.filter((w) => !w.isCustom && worlds.filter((x) => x.category === w.category && !x.isCustom).length < 2)}
          />

          <section className="section" aria-labelledby="own-worlds">
            <div className="section-header">
              <h2 id="own-worlds" className="row">
                <Plus aria-hidden className="icon-sm accent" /> {t('categories.custom')}
              </h2>
              <Link to="/worlds">{t('common.viewAll')}</Link>
            </div>
            <div className="h-scroll world-row">
              {own.map((w) => (
                <WorldCard key={w.id} world={w} />
              ))}
              <CreateWorldCard />
            </div>
          </section>

          <section className="section" aria-labelledby="discover-figures">
            <div className="section-header">
              <h2 id="discover-figures" className="row">
                <Users aria-hidden className="icon-sm accent" /> {t('discover.figures')}
              </h2>
              <Link to="/characters">{t('common.viewAll')}</Link>
            </div>
            <p className="small muted">{t('discover.figuresHint')}</p>
            {discover.data.figures.length === 0 ? (
              <EmptyState icon={Users} title={t('characters.empty')} />
            ) : (
              <div className="h-scroll">
                {discover.data.figures.map((c) => (
                  <CharacterCard key={c.id} character={c} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      <p className="xsmall faint discover-notice">
        {t('discover.fictionNotice')} {t('discover.activityHint')}.
      </p>
    </div>
  );
}
