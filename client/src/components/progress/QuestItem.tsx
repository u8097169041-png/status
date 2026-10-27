import { CheckCircle2, Circle, Gift } from 'lucide-react';
import type { QuestProgressDto } from '../../../../shared/types';
import { useClaimQuest } from '../../api/hooks';
import { useI18n } from '../../i18n';
import { useToast } from '../ui/Toast';
import { useErrorToast, useProgressFeedback } from './useProgressFeedback';

export function QuestItem({ quest }: { quest: QuestProgressDto }) {
  const { t, td } = useI18n();
  const claim = useClaimQuest();
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const pct = Math.round((quest.current / quest.target) * 100);
  return (
    <li className={`quest ${quest.claimed ? 'claimed' : quest.completed ? 'completed' : ''}`}>
      <span className="quest-icon" aria-hidden>
        {quest.completed ? <CheckCircle2 /> : <Circle />}
      </span>
      <div className="quest-body">
        <div className="row-between">
          <strong className="small">{td(`quests.${quest.id}`, quest.id)}</strong>
          <span className="badge">+{quest.xp} XP</span>
        </div>
        <div className="row">
          <div
            className="progress progress-sm grow"
            role="progressbar"
            aria-label={td(`quests.${quest.id}`, quest.id)}
            aria-valuemin={0}
            aria-valuemax={quest.target}
            aria-valuenow={quest.current}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="xsmall faint">
            {quest.current}/{quest.target}
          </span>
        </div>
      </div>
      {quest.completed && !quest.claimed && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={claim.isPending}
          onClick={() =>
            claim.mutate(quest.id, {
              onSuccess: (r) => {
                push('success', t('progress.claimedToast'));
                feedback(r.progress);
              },
              onError: showError,
            })
          }
        >
          <Gift aria-hidden /> {t('progress.claim')}
        </button>
      )}
      {quest.claimed && <span className="xsmall success-text">{t('progress.claimed')}</span>}
    </li>
  );
}

export function LevelBar({ level, xp, current, next, progress }: { level: number; xp: number; current: number; next: number; progress: number }) {
  const { t } = useI18n();
  return (
    <div className="level-bar">
      <div className="row-between">
        <strong className="level-badge">{t('progress.level', { level })}</strong>
        <span className="xsmall muted">
          {xp - current}/{next - current} XP
        </span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={t('progress.level', { level })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <span className="xsmall faint">{t('progress.toNext', { xp: next - xp, level: level + 1 })}</span>
    </div>
  );
}
