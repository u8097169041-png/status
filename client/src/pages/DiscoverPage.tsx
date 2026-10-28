import { ArrowRight, BookOpen, Flame, Globe2, LogIn, Plus, Sparkles, Trophy, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { WORLD_CATEGORIES, type WorldCategory } from '../../../shared/constants';
import type { WorldSummary } from '../../../shared/types';
import { useBootstrap, useDiscover, usePlayActions, useProgress } from '../api/hooks';
import { AiModeBadge } from '../components/AiModeBadge';
import { CharacterCard } from '../components/characters/CharacterCard';
import { QuestItem } from '../components/progress/QuestItem';
import { useErrorToast } from '../components/progress/useProgressFeedback';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/States';
import { WorldArt } from '../components/ui/WorldArt';
import { EventTimeline } from '../components/worlds/EventTimeline';
import { MetricBars } from '../components/worlds/MetricBars';
import { StorylineCard } from '../components/worlds/StorylineCard';
import { WorldCard } from '../components/worlds/WorldCard';
import { useI18n } from '../i18n';

function Hero({ world }: { world: WorldSummary }) {
  const { t, td } = useI18n();
  return (
    <section className="hero" style={{ '--world-hue': world.hue } as React.CSSProperties}>
      <WorldArt seed={world.id} style={world.artStyle} hue={world.hue} className="hero-art" />
      <div className="hero-overlay" />
      <div className="hero-content">
        <span className="eyebrow">{td(`categories.${world.category}`, world.category)}</span>
        <h1>{world.name}</h1>
        <p className="hero-tagline">{world.tagline}</p>
        {world.lastEventTitle && (
          <p className="hero-event">
            <Flame aria-hidden /> {world.lastEventTitle}
          </p>
        )}
        <div className="row wrap">
          {world.joined ? (
            <Link to={`/worlds/${world.id}`} className="btn btn-primary">
              {t('discover.continue')} <ArrowRight aria-hidden />
            </Link>
          ) : (
            <Link to={`/worlds/${world.id}/join`} className="btn btn-primary">
              <LogIn aria-hidden /> {t('discover.join')}
            </Link>
          )}
          <Link to={`/worlds/${world.id}`} className="btn btn-secondary">
            {t('discover.preview')}
          </Link>
        </div>
      </div>
      <div className="hero-side">
        <span className="badge">{td(`genres.${world.genre}`, world.genre)}</span>
        <span className="xsmall muted">{t('worlds.day', { day: world.day })}</span>
        <MetricBars metrics={world.metrics} />
      </div>
    </section>
  );
}

/** Entdecken: Weltvorschauen, bekannte Figuren, Szenarien und Ereignisse – ohne Stories. */
export function DiscoverPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const discover = useDiscover();
  const { data: boot } = useBootstrap();
  const { data: progress } = useProgress();
  const play = usePlayActions();
  const showError = useErrorToast();
  const [category, setCategory] = useState<WorldCategory | 'all'>('all');

  const worlds = useMemo(() => discover.data?.worlds ?? [], [discover.data]);
  const categories = useMemo(() => WORLD_CATEGORIES.filter((c) => worlds.some((w) => w.category === c)), [worlds]);
  const filtered = category === 'all' ? worlds : worlds.filter((w) => w.category === category);
  const joined = boot?.joinedWorlds ?? [];

  return (
    <div className="page">
      <header className="page-header">
        <div className="titles">
          <h1>{t('discover.title')}</h1>
          <p>{t('discover.subtitlePlay')}</p>
        </div>
        <AiModeBadge status={boot?.ai} compact />
      </header>
      {discover.isPending && <SkeletonList count={2} height={220} />}
      {discover.isError && <ErrorState error={discover.error} onRetry={() => void discover.refetch()} />}
      {discover.data && (
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
                      <span className="xsmall muted block truncate">{t('play.playingAs', { name: player.character.name })}</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={play.setWorld.isPending}
                      onClick={() => play.setWorld.mutate(world.id, { onSuccess: () => navigate('/feed'), onError: showError })}
                    >
                      {t('discover.continue')} <ArrowRight aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {discover.data.featuredWorld && <Hero world={discover.data.featuredWorld} />}

          <section className="section" aria-labelledby="discover-worlds">
            <div className="section-header">
              <h2 id="discover-worlds" className="row">
                <Globe2 aria-hidden className="icon-sm accent" /> {t('discover.worlds')}
              </h2>
              <Link to="/worlds">{t('common.viewAll')}</Link>
            </div>
            <div className="chip-row scroll" role="group" aria-label={t('discover.categoryFilter')}>
              <button type="button" className="chip" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
                {t('discover.allCategories')}
              </button>
              {categories.map((c) => (
                <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
                  {t(`categories.${c}`)}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <p className="muted small">{t('discover.noWorldsInCategory')}</p>
            ) : (
              <div className="h-scroll">
                {filtered.map((w) => (
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

          <div className="with-rail">
            <div className="stack">
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

              <section className="section" aria-labelledby="discover-events">
                <div className="section-header">
                  <h2 id="discover-events" className="row">
                    <Sparkles aria-hidden className="icon-sm accent" /> {t('discover.events')}
                  </h2>
                </div>
                <div className="card">
                  <EventTimeline events={discover.data.recentEvents} showWorld />
                </div>
              </section>
            </div>

            <aside className="rail rail-visible-mobile" aria-label={t('discover.scenarios')}>
              {discover.data.scenarios.length > 0 && (
                <section className="stack-sm">
                  <h2 className="rail-title row">
                    <BookOpen aria-hidden className="icon-sm accent" /> {t('discover.scenarios')}
                  </h2>
                  {discover.data.scenarios.slice(0, 6).map((s) => (
                    <Link key={s.id} to={`/worlds/${s.worldId}`} className="plain-link">
                      <StorylineCard storyline={s} worldName={s.worldName} />
                    </Link>
                  ))}
                </section>
              )}
              {progress && (
                <section className="card">
                  <div className="card-title">
                    <h2>
                      <Trophy aria-hidden /> {t('discover.dailyQuests')}
                    </h2>
                    <Link to="/tasks" className="xsmall">
                      {t('common.viewAll')}
                    </Link>
                  </div>
                  <ul className="quest-list">
                    {progress.daily.map((q) => (
                      <QuestItem key={q.id} quest={q} />
                    ))}
                  </ul>
                </section>
              )}
              <p className="xsmall faint">{t('discover.fictionNotice')}</p>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
