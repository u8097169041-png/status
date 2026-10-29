import { ArrowRight, BookOpen, CalendarDays, LogIn, MessageSquare } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import type { WorldSummary } from '../../../../shared/types';
import { usePlayActions } from '../../api/hooks';
import { useI18n } from '../../i18n';
import { useErrorToast } from '../progress/useProgressFeedback';
import { Avatar } from '../ui/Avatar';
import { WorldArt } from '../ui/WorldArt';

/** Weltkarte für die Weltauswahl: Titelbild, Kategorie, Beschreibung, Figuren und (simulierte) Aktivität. */
export function WorldCard({ world }: { world: WorldSummary }) {
  const { t, td } = useI18n();
  const navigate = useNavigate();
  const { setWorld } = usePlayActions();
  const showError = useErrorToast();
  return (
    <article className="world-card" style={{ '--world-hue': world.hue } as React.CSSProperties} aria-labelledby={`world-${world.id}`}>
      <Link to={`/worlds/${world.id}`} className="world-card-art" tabIndex={-1} aria-hidden>
        <WorldArt seed={world.id} style={world.artStyle} hue={world.hue} imageUrl={world.coverUrl} />
        <span className="world-card-genre badge">{td(`categories.${world.category}`, world.category)}</span>
        {world.joined ? (
          <span className="world-card-custom badge badge-player">{t('discover.joined')}</span>
        ) : (
          world.isCustom && <span className="world-card-custom badge badge-demo">{t('labels.custom')}</span>
        )}
      </Link>
      <div className="world-card-body">
        <h3 id={`world-${world.id}`}>
          <Link to={`/worlds/${world.id}`} className="plain-link">
            {world.name}
          </Link>
        </h3>
        <p className="muted small clamp-2">{world.tagline}</p>
        {world.cast.length > 0 && (
          <div className="row world-card-cast">
            <span className="avatar-stack" role="img" aria-label={t('discover.cast', { names: world.cast.map((c) => c.name).join(', ') })}>
              {world.cast.map((c) => (
                <Avatar key={c.id} name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} size="xs" decorative />
              ))}
            </span>
            <span className="xsmall muted truncate">
              {world.cast[0].name}
              {world.characterCount > 1 && ` ${t('discover.moreCast', { count: world.characterCount - 1 })}`}
            </span>
          </div>
        )}
        <div className="row wrap world-card-meta" title={t('discover.activityHint')}>
          <span className="row xsmall muted">
            <CalendarDays aria-hidden className="icon-xs" /> {t('worlds.day', { day: world.day })}
          </span>
          <span className="row xsmall muted">
            <MessageSquare aria-hidden className="icon-xs" /> {t('discover.activity', { posts: world.postsToday })}
          </span>
          <span className="row xsmall muted">
            <BookOpen aria-hidden className="icon-xs" /> {t('discover.storylinesCount', { count: world.activeStorylines })}
          </span>
        </div>
        <div className="row world-card-actions">
          {world.joined ? (
            <button
              type="button"
              className="btn btn-primary btn-sm grow"
              disabled={setWorld.isPending}
              onClick={() => setWorld.mutate(world.id, { onSuccess: () => navigate('/feed'), onError: showError })}
            >
              {t('discover.continue')} <ArrowRight aria-hidden />
            </button>
          ) : (
            <Link to={`/worlds/${world.id}/join`} className="btn btn-primary btn-sm grow" aria-label={`${t('discover.join')}: ${world.name}`}>
              <LogIn aria-hidden /> {t('discover.join')}
            </Link>
          )}
          <Link to={`/worlds/${world.id}`} className="btn btn-secondary btn-sm" aria-label={`${t('discover.preview')}: ${world.name}`}>
            {t('discover.preview')}
          </Link>
        </div>
      </div>
    </article>
  );
}
