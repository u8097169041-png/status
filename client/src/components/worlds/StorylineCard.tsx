import { BookOpen, CheckCircle2, GitBranch } from 'lucide-react';
import type { StorylineDto } from '../../../../shared/types';
import { useI18n } from '../../i18n';

export function StorylineCard({ storyline, worldName }: { storyline: StorylineDto; worldName?: string }) {
  const { t } = useI18n();
  const total = Math.max(1, storyline.stages.length);
  const resolved = storyline.status === 'resolved';
  return (
    <div className={`storyline card ${resolved ? 'resolved' : ''}`}>
      <div className="row-between">
        <span className="row xsmall muted">
          {resolved ? <CheckCircle2 aria-hidden className="icon-xs" /> : <BookOpen aria-hidden className="icon-xs" />}
          {worldName ?? (resolved ? t('worlds.resolved') : t('worlds.active'))}
        </span>
        <span className="xsmall faint">{t('worlds.stage', { stage: storyline.stage + 1, total })}</span>
      </div>
      <h3>{storyline.title}</h3>
      <p className="small muted clamp-3">{storyline.summary}</p>
      <ol className="stage-track" aria-label={t('worlds.stage', { stage: storyline.stage + 1, total })}>
        {storyline.stages.map((stage, i) => (
          <li key={i} className={i < storyline.stage ? 'done' : i === storyline.stage ? 'current' : ''} title={stage}>
            <span className="sr-only">{stage}</span>
          </li>
        ))}
      </ol>
      <p className="small">{storyline.stages[storyline.stage]}</p>
      {storyline.endings.length > 0 && (
        <div className="storyline-endings">
          <span className="xsmall muted row">
            <GitBranch aria-hidden className="icon-xs" /> {resolved ? t('storyline.endingReached') : t('storyline.endings')}
          </span>
          <ul className="arc-endings">
            {storyline.endings
              .filter((e) => !resolved || e.id === storyline.endingId)
              .map((e) => (
                <li
                  key={e.id}
                  className={`arc-ending-chip path-${e.path} ${e.id === storyline.endingId ? 'reached' : ''} ${e.id === storyline.forecastEndingId ? 'forecast' : ''}`}
                  title={e.description}
                >
                  {e.title}
                  {e.id === storyline.forecastEndingId && ` · ${t('storyline.forecast')}`}
                </li>
              ))}
          </ul>
          {resolved && <p className="xsmall muted">{storyline.endings.find((e) => e.id === storyline.endingId)?.description}</p>}
        </div>
      )}
    </div>
  );
}
