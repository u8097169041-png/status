import { Check, Lock, Megaphone, MessageCircleHeart, Plus, Scale, Target } from 'lucide-react';
import { SKILL_MAX_LEVEL, type SkillId } from '../../../shared/skills';
import type { SkillDto } from '../../../shared/types';
import { useSkills, useUpgradeSkill } from '../api/hooks';
import { LevelCard } from '../components/play/QuestUI';
import { NotJoinedState, useActivePlay } from '../components/play/PlayUI';
import { useErrorToast } from '../components/progress/useProgressFeedback';
import { ErrorState, SkeletonList } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useI18n, type TKey } from '../i18n';

const SKILL_ICONS: Record<SkillId, typeof Scale> = {
  charisma: MessageCircleHeart,
  media: Megaphone,
  negotiation: Scale,
  strategy: Target,
};

function SkillCard({ skill, worldId }: { skill: SkillDto; worldId: string }) {
  const { t } = useI18n();
  const upgrade = useUpgradeSkill(worldId);
  const showError = useErrorToast();
  const { push } = useToast();
  const Icon = SKILL_ICONS[skill.id];
  const name = t(`skills.${skill.id}` as TKey);
  const blocked =
    skill.blockedReason === 'max'
      ? t('skills.max')
      : skill.blockedReason === 'level'
        ? t('skills.needLevel', { level: skill.nextRequiredLevel ?? 0 })
        : skill.blockedReason === 'points'
          ? t('skills.needPoints')
          : null;
  return (
    <article className={`skill-card card ${skill.core ? 'core' : ''}`} aria-labelledby={`skill-${skill.id}`}>
      <header className="row">
        <span className="skill-icon" aria-hidden>
          <Icon />
        </span>
        <div className="grow min-w-0">
          <h2 id={`skill-${skill.id}`} className="row wrap">
            {name}
            {skill.core && (
              <span className="badge badge-player" title={t('skills.coreHint')}>
                {t('skills.core')}
              </span>
            )}
          </h2>
          <span className="xsmall muted">{t(`skills.${skill.id}Desc` as TKey)}</span>
        </div>
        <span className="skill-pips" role="img" aria-label={t('skills.levelN', { level: skill.level })}>
          {Array.from({ length: SKILL_MAX_LEVEL }, (_, i) => (
            <span key={i} className={i < skill.level ? 'on' : ''} />
          ))}
        </span>
      </header>
      <ol className="skill-levels">
        {Array.from({ length: SKILL_MAX_LEVEL }, (_, i) => {
          const level = i + 1;
          const unlocked = skill.level >= level;
          return (
            <li key={level} className={unlocked ? 'unlocked' : ''}>
              <span className="skill-level-badge">
                {unlocked ? <Check aria-hidden className="icon-xs" /> : <Lock aria-hidden className="icon-xs" />}
                {t('skills.levelN', { level })}
              </span>
              <span className="small">{t(`skills.${skill.id}${level}` as TKey)}</span>
            </li>
          );
        })}
      </ol>
      <footer className="row-between wrap">
        <span className="xsmall muted">{skill.level < skill.maxLevel ? t('skills.cost', { cost: skill.cost }) : ''}</span>
        {blocked ? (
          <span className="xsmall faint">{blocked}</span>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={upgrade.isPending}
            onClick={() =>
              upgrade.mutate(skill.id, {
                onSuccess: () => push('success', t('skills.upgraded', { skill: name, level: skill.level + 1 })),
                onError: showError,
              })
            }
          >
            <Plus aria-hidden /> {t('skills.upgrade')}
          </button>
        )}
      </footer>
    </article>
  );
}

/** Fähigkeiten der aktiven Spielfigur mit ihren konkreten Auswirkungen je Stufe. */
export function SkillsPage() {
  const { t } = useI18n();
  const { worldId } = useActivePlay();
  const skills = useSkills(worldId);
  if (!worldId) {
    return (
      <div className="page">
        <NotJoinedState />
      </div>
    );
  }
  return (
    <div className="page stack">
      <header className="page-header">
        <div className="titles">
          <h1>{t('skills.title')}</h1>
          <p>{t('skills.subtitle')}</p>
        </div>
        {skills.data && (
          <span className="coin-balance" aria-label={t('skills.points')}>
            {t('skills.pointsDetail', { available: skills.data.player.skillPoints.available, earned: skills.data.player.skillPoints.earned })}
          </span>
        )}
      </header>
      {skills.isPending && <SkeletonList count={2} height={220} />}
      {skills.isError && <ErrorState error={skills.error} onRetry={() => void skills.refetch()} />}
      {skills.data && (
        <>
          <LevelCard player={skills.data.player} hideSkillsLink />
          <p className="xsmall muted">{t('skills.coreHint')}</p>
          <div className="skill-grid">
            {skills.data.skills.map((s) => (
              <SkillCard key={s.id} skill={s} worldId={worldId} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
