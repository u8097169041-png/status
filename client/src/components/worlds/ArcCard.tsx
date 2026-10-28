import { Flag, GitBranch } from 'lucide-react';
import { Link } from 'react-router';
import type { StorylineDto } from '../../../../shared/types';
import { useI18n } from '../../i18n';

/** Interaktiver Handlungsbogen: Fortschritt in Kapiteln und mögliche Enden. */
export function ArcCard({ arc }: { arc: StorylineDto & { worldName: string; worldHue: number; worldJoined: boolean } }) {
  const { t } = useI18n();
  const total = Math.max(1, arc.stages.length);
  const reached = arc.endings.find((e) => e.id === arc.endingId);
  const pct = Math.round(((arc.stage + 1) / total) * 100);
  return (
    <article className="arc-card card" style={{ '--world-hue': arc.worldHue } as React.CSSProperties} aria-labelledby={`arc-${arc.id}`}>
      <span className="world-chip">{arc.worldName}</span>
      <h3 id={`arc-${arc.id}`}>{arc.title}</h3>
      <p className="small muted clamp-2">{arc.summary}</p>
      <div className="row-between xsmall muted">
        <span>{t('discover.chapter', { stage: arc.stage + 1, total })}</span>
        <span className="row">
          <GitBranch aria-hidden className="icon-xs" /> {t('discover.endingsCount', { count: arc.endings.length })}
        </span>
      </div>
      <div
        className="progress progress-sm"
        role="progressbar"
        aria-label={t('discover.chapter', { stage: arc.stage + 1, total })}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={arc.stage + 1}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      {reached ? (
        <p className="arc-ending small">
          <Flag aria-hidden className="icon-xs" /> {t('discover.endingReached', { ending: reached.title })}
        </p>
      ) : (
        <ul className="arc-endings" aria-label={t('storyline.endings')}>
          {arc.endings.map((e) => (
            <li key={e.id} className={`arc-ending-chip path-${e.path}`}>
              {e.title}
            </li>
          ))}
        </ul>
      )}
      <Link to={arc.worldJoined ? '/tasks' : `/worlds/${arc.worldId}`} className="btn btn-secondary btn-sm">
        {arc.worldJoined ? t('discover.play') : t('discover.preview')}
      </Link>
    </article>
  );
}
