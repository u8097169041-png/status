import { Heart, Lock, Target } from 'lucide-react';
import type { ChatActionDto } from '../../../../shared/types';
import { useChatActionList, usePerformChatAction } from '../../api/hooks';
import { useI18n, type TKey } from '../../i18n';
import { useErrorToast, useProgressFeedback } from '../progress/useProgressFeedback';
import { useToast } from '../ui/Toast';

function reasonText(a: ChatActionDto, t: (k: TKey, v?: Record<string, string | number>) => string): string | null {
  switch (a.reason) {
    case 'skill':
      return a.requires ? t('chatActions.reasonSkill', { skill: t(`skills.${a.requires.skill}` as TKey), level: a.requires.level }) : null;
    case 'used':
      return t('chatActions.reasonUsed');
    case 'affinityLow':
      return t('chatActions.reasonLow', { value: a.minAffinity ?? 0 });
    case 'affinityHigh':
      return t('chatActions.reasonHigh', { value: a.maxAffinity ?? 0 });
    default:
      return null;
  }
}

/** Dialogoptionen gegenüber einer Figur: freigeschaltet durch Fähigkeiten und Beziehung, mit echter Wirkung. */
export function ChatActionsBar({ characterId, characterName, disabled }: { characterId: string; characterName: string; disabled?: boolean }) {
  const { t } = useI18n();
  const list = useChatActionList(characterId, true);
  const perform = usePerformChatAction(characterId);
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  if (!list.data) return null;
  const data = list.data;
  return (
    <section className="chat-actions" aria-label={t('chatActions.title')}>
      <div className="row-between wrap">
        <span className="xsmall muted row">
          <Heart aria-hidden className="icon-xs" /> {t('chatActions.affinity', { value: data.affinity })}
        </span>
        {data.knownGoals && data.knownGoals.length > 0 && (
          <span className="xsmall muted row truncate" title={data.knownGoals.join(' · ')}>
            <Target aria-hidden className="icon-xs" /> {t('chatActions.knownGoals', { name: characterName })}: {data.knownGoals[0]}
          </span>
        )}
      </div>
      <div className="chip-row scroll" role="group" aria-label={t('chatActions.title')}>
        {data.actions.map((a) => {
          const label = t(`chatActions.${a.id}` as TKey);
          const reason = reasonText(a, t);
          return (
            <button
              key={a.id}
              type="button"
              className={`chip chat-action ${a.available ? '' : 'locked'}`}
              disabled={!a.available || perform.isPending || disabled}
              title={reason ?? (a.affinity ? t('chatActions.effect', { value: a.affinity }) : undefined)}
              aria-label={reason ? `${label} – ${reason}` : label}
              onClick={() =>
                perform.mutate(a.id, {
                  onSuccess: (r) => {
                    push('success', label, t('chatActions.result', { before: r.affinityBefore, after: r.affinityAfter }));
                    feedback(r.message.progress);
                  },
                  onError: showError,
                })
              }
            >
              {!a.available && <Lock aria-hidden className="icon-xs" />}
              {label}
              {a.available && a.affinity > 0 && <span className="faint">+{a.affinity}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
