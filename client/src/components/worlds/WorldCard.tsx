import { BookOpen, Users } from 'lucide-react';
import { Link } from 'react-router';
import type { WorldSummary } from '../../../../shared/types';
import { useI18n } from '../../i18n';
import { WorldArt } from '../ui/WorldArt';

export function WorldCard({ world }: { world: WorldSummary }) {
  const { t, td } = useI18n();
  return (
    <Link to={`/worlds/${world.id}`} className="world-card card-interactive" style={{ '--world-hue': world.hue } as React.CSSProperties}>
      <div className="world-card-art">
        <WorldArt seed={world.id} style={world.artStyle} hue={world.hue} />
        <span className="world-card-genre badge">{td(`categories.${world.category}`, td(`genres.${world.genre}`, world.genre))}</span>
        {world.joined ? (
          <span className="world-card-custom badge badge-player">{t('discover.joined')}</span>
        ) : (
          world.isCustom && <span className="world-card-custom badge badge-demo">{t('labels.custom')}</span>
        )}
      </div>
      <div className="world-card-body">
        <div className="row-between">
          <h3>{world.name}</h3>
          <span className="faint xsmall">{t('worlds.day', { day: world.day })}</span>
        </div>
        <p className="muted small clamp-2">{world.tagline}</p>
        <div className="row wrap world-card-meta">
          <span className="row xsmall muted">
            <Users aria-hidden className="icon-xs" /> {t('worlds.characterCount', { count: world.characterCount })}
          </span>
          <span className="row xsmall muted">
            <BookOpen aria-hidden className="icon-xs" /> {t('worlds.storylineCount', { count: world.activeStorylines })}
          </span>
        </div>
        {world.lastEventTitle && <p className="xsmall faint truncate">{t('worlds.lastEvent', { title: world.lastEventTitle })}</p>}
      </div>
    </Link>
  );
}
