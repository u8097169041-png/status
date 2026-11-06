import { BookOpen, HeartPulse, MapPin, Plus, Skull } from 'lucide-react';
import { Link } from 'react-router';
import type { LifeGenre, LifeStorySummaryDto } from '../../../shared/life';
import { useLifeStories } from '../api/lifeHooks';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/States';
import { RelativeTime } from '../components/ui/RelativeTime';
import { useI18n } from '../i18n';

/** Farbton je Genre für die gezeichneten Titelbilder (ohne Bild-KI). */
export const GENRE_HUE: Record<LifeGenre, number> = { crime: 350, romance: 330, politics: 215, business: 190, fame: 45, drama: 265 };

export function LifeCover({ story, className = '' }: { story: Pick<LifeStorySummaryDto, 'coverUrl' | 'genres' | 'title' | 'status'>; className?: string }) {
  const hue = GENRE_HUE[story.genres[0] ?? 'drama'];
  return (
    <div
      className={`life-cover ${story.status === 'ended' ? 'ended' : ''} ${className}`}
      style={{ '--cover-hue': hue, ...(story.coverUrl ? { backgroundImage: `url("${story.coverUrl}")` } : {}) } as React.CSSProperties}
      aria-hidden
    >
      {!story.coverUrl && <BookOpen />}
    </div>
  );
}

function StoryCard({ story }: { story: LifeStorySummaryDto }) {
  const { t, td } = useI18n();
  const health = story.highlight.find((h) => h.stat === 'health')?.value ?? 0;
  return (
    <Link to={`/life/${story.id}`} className="card card-interactive life-story-card">
      <LifeCover story={story} />
      <div className="stack-sm">
        <div className="row-between">
          <span className="row xsmall">
            {story.genres.map((g) => (
              <span key={g} className="badge">
                {td(`lifeGenres.${g}`, g)}
              </span>
            ))}
          </span>
          {story.status === 'ended' ? (
            <span className="badge badge-danger">
              <Skull aria-hidden /> {t('life.ended')}
            </span>
          ) : (
            <span className="badge badge-success">{t('life.active')}</span>
          )}
        </div>
        <h3 className="truncate">{story.title}</h3>
        <p className="small muted truncate">{t('life.as', { name: story.playerName, role: story.playerRole })}</p>
        <p className="xsmall faint row">
          {t('life.dayTurn', { day: story.day, turn: story.turn })}
          {story.location && (
            <>
              {' · '}
              <MapPin aria-hidden className="icon-xs" /> {story.location}
            </>
          )}
        </p>
        <div className="life-mini-stats">
          {story.highlight
            .filter((h) => h.stat !== 'health')
            .map((h) => (
              <span key={h.stat} className="xsmall">
                {td(`lifeStats.${h.stat}`, h.stat)} <strong>{h.value}</strong>
              </span>
            ))}
          <span className="xsmall">
            <HeartPulse aria-hidden className="icon-xs" /> <strong>{health}</strong>
          </span>
        </div>
        <span className="xsmall faint">
          <RelativeTime iso={story.updatedAt} />
        </span>
      </div>
    </Link>
  );
}

export function LifeStoriesPage() {
  const { t } = useI18n();
  const stories = useLifeStories();
  return (
    <div className="page">
      <header className="page-header">
        <div className="titles">
          <h1>{t('life.title')}</h1>
          <p>{t('life.intro')}</p>
        </div>
        <div className="actions">
          <Link to="/life/new" className="btn btn-primary">
            <Plus aria-hidden /> {t('life.navNew')}
          </Link>
        </div>
      </header>
      {stories.isPending && <SkeletonList count={2} height={200} />}
      {stories.isError && <ErrorState error={stories.error} onRetry={() => void stories.refetch()} />}
      {stories.data && stories.data.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title={t('life.empty')}
          text={t('life.emptyHint')}
          action={
            <Link to="/life/new" className="btn btn-primary">
              <Plus aria-hidden /> {t('life.start')}
            </Link>
          }
        />
      )}
      {stories.data && stories.data.length > 0 && (
        <div className="grid-cards life-grid">
          {stories.data.map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </div>
      )}
    </div>
  );
}
