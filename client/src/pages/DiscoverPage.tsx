import { ArrowRight, BookOpen, Flame, Globe2, Hash, Hourglass, Plus, Sparkles, Trophy, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useBootstrap, useDiscover, useProgress, useWorldActions } from '../api/hooks';
import { AiModeBadge } from '../components/AiModeBadge';
import { CharacterCard } from '../components/characters/CharacterCard';
import { StoriesBar } from '../components/feed/Stories';
import { PostCard } from '../components/feed/PostCard';
import { QuestItem } from '../components/progress/QuestItem';
import { useErrorToast, useProgressFeedback } from '../components/progress/useProgressFeedback';
import { ErrorState, SkeletonList } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { WorldArt } from '../components/ui/WorldArt';
import { EventTimeline } from '../components/worlds/EventTimeline';
import { MetricBars } from '../components/worlds/MetricBars';
import { StorylineCard } from '../components/worlds/StorylineCard';
import { WorldCard } from '../components/worlds/WorldCard';
import { useI18n } from '../i18n';
import type { WorldSummary } from '../../../shared/types';

function Hero({ world }: { world: WorldSummary }) {
  const { t, td } = useI18n();
  const navigate = useNavigate();
  const { simulate } = useWorldActions(world.id);
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  return (
    <section className="hero" style={{ '--world-hue': world.hue } as React.CSSProperties}>
      <WorldArt seed={world.id} style={world.artStyle} hue={world.hue} className="hero-art" />
      <div className="hero-overlay" />
      <div className="hero-content">
        <span className="eyebrow">{t('discover.heroEyebrow')}</span>
        <h1>{world.name}</h1>
        <p className="hero-tagline">{world.tagline}</p>
        {world.lastEventTitle && (
          <p className="hero-event">
            <Flame aria-hidden /> {world.lastEventTitle}
          </p>
        )}
        <div className="row wrap">
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/worlds/${world.id}`)}>
            {t('discover.enterWorld')} <ArrowRight aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={simulate.isPending}
            onClick={() =>
              simulate.mutate(undefined, {
                onSuccess: (r) => {
                  push(
                    'info',
                    r.events.length ? t('worlds.simulated', { day: r.world.day, count: r.events.length }) : t('worlds.simulatedNone'),
                    r.events.map((e) => e.title).join(' · '),
                  );
                  feedback(r.progress);
                },
                onError: showError,
              })
            }
          >
            {simulate.isPending ? <span className="spinner" aria-hidden /> : <Hourglass aria-hidden />}
            {simulate.isPending ? t('worlds.simulating') : t('discover.simulateNow')}
          </button>
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

export function DiscoverPage() {
  const { t } = useI18n();
  const discover = useDiscover();
  const { data: boot } = useBootstrap();
  const { data: progress } = useProgress();

  return (
    <div className="page">
      <header className="page-header">
        <div className="titles">
          <h1>{t('discover.title')}</h1>
          <p>{t('discover.subtitle')}</p>
        </div>
        <AiModeBadge status={boot?.ai} compact />
      </header>
      <StoriesBar />
      {discover.isPending && <SkeletonList count={2} height={220} />}
      {discover.isError && <ErrorState error={discover.error} onRetry={() => void discover.refetch()} />}
      {discover.data && (
        <div className="stack discover">
          {discover.data.featuredWorld && <Hero world={discover.data.featuredWorld} />}

          <section className="section">
            <div className="section-header">
              <h2 className="row">
                <Globe2 aria-hidden className="icon-sm accent" /> {t('discover.worlds')}
              </h2>
              <Link to="/worlds">{t('common.viewAll')}</Link>
            </div>
            <div className="h-scroll">
              {discover.data.worlds.map((w) => (
                <WorldCard key={w.id} world={w} />
              ))}
              <Link to="/worlds/new" className="create-tile card-interactive">
                <Plus aria-hidden />
                <strong>{t('discover.createWorld')}</strong>
                <span className="small muted">{t('discover.createWorldHint')}</span>
              </Link>
            </div>
          </section>

          <div className="with-rail">
            <div className="stack">
              <section className="section">
                <div className="section-header">
                  <h2 className="row">
                    <Sparkles aria-hidden className="icon-sm accent" /> {t('discover.events')}
                  </h2>
                </div>
                <div className="card">
                  <EventTimeline events={discover.data.recentEvents} showWorld />
                </div>
              </section>

              {discover.data.highlightPosts.length > 0 && (
                <section className="section">
                  <div className="section-header">
                    <h2 className="row">
                      <Flame aria-hidden className="icon-sm accent" /> {t('discover.highlights')}
                    </h2>
                    <Link to="/feed">{t('common.viewAll')}</Link>
                  </div>
                  <div className="feed-list">
                    {discover.data.highlightPosts.map((p) => (
                      <PostCard key={p.id} post={p} />
                    ))}
                  </div>
                </section>
              )}

              <section className="section">
                <div className="section-header">
                  <h2 className="row">
                    <Users aria-hidden className="icon-sm accent" /> {t('discover.characters')}
                  </h2>
                  <Link to="/characters">{t('common.viewAll')}</Link>
                </div>
                <div className="h-scroll">
                  {discover.data.characters.map((c) => (
                    <CharacterCard key={c.id} character={c} />
                  ))}
                </div>
              </section>
            </div>

            <aside className="rail rail-visible-mobile" aria-label={t('discover.dailyQuests')}>
              {progress && (
                <section className="card">
                  <div className="card-title">
                    <h2>
                      <Trophy aria-hidden /> {t('discover.dailyQuests')}
                    </h2>
                    <Link to="/progress" className="xsmall">
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
              {discover.data.trendingTags.length > 0 && (
                <section className="card">
                  <div className="card-title">
                    <h2>
                      <Hash aria-hidden /> {t('discover.trending')}
                    </h2>
                  </div>
                  <div className="chip-row">
                    {discover.data.trendingTags.map((tag) => (
                      <Link key={tag.tag} to={`/feed?tag=${encodeURIComponent(tag.tag)}`} className="chip">
                        #{tag.tag} <span className="faint">{tag.count}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
              {discover.data.storylines.length > 0 && (
                <section className="stack-sm">
                  <h2 className="rail-title row">
                    <BookOpen aria-hidden className="icon-sm accent" /> {t('discover.storylines')}
                  </h2>
                  {discover.data.storylines.slice(0, 4).map((s) => (
                    <Link key={s.id} to={`/worlds/${s.worldId}`} className="plain-link">
                      <StorylineCard storyline={s} worldName={s.worldName} />
                    </Link>
                  ))}
                </section>
              )}
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
