import {
  Award,
  BookMarked,
  Crown,
  Footprints,
  Globe2,
  Heart,
  Lock,
  MessageCircle,
  MessagesSquare,
  Palette,
  Scale,
  Scroll,
  Sparkles,
  Stamp,
  Trophy,
  UserPlus,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { XP_RULES, type XpAction } from '../../../shared/progress';
import type { ProgressDto } from '../../../shared/types';
import { useBootstrap, useProgress, useUpdateProfile } from '../api/hooks';
import { LevelBar, QuestItem } from '../components/progress/QuestItem';
import { useErrorToast } from '../components/progress/useProgressFeedback';
import { Avatar } from '../components/ui/Avatar';
import { ErrorState, SkeletonList } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { WorldArt } from '../components/ui/WorldArt';
import { useI18n } from '../i18n';
import { formatDate } from '../lib/format';

const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  footprints: Footprints,
  messages: MessagesSquare,
  message: MessageCircle,
  bookmark: BookMarked,
  'user-plus': UserPlus,
  globe: Globe2,
  zap: Zap,
  scroll: Scroll,
  heart: Heart,
  crown: Crown,
  scale: Scale,
};

export function AchievementGrid({ achievements }: { achievements: ProgressDto['achievements'] }) {
  const { td, locale } = useI18n();
  return (
    <ul className="achievement-grid">
      {achievements.map((a) => {
        const Icon = ACHIEVEMENT_ICONS[a.icon] ?? Award;
        const unlocked = Boolean(a.unlockedAt);
        return (
          <li key={a.id} className={`achievement ${unlocked ? 'unlocked' : ''}`}>
            <span className="achievement-icon" aria-hidden>
              {unlocked ? <Icon /> : <Lock />}
            </span>
            <strong className="small">{td(`achievements.${a.id}`, a.id)}</strong>
            <span className="xsmall muted">{td(`achievements.${a.id}.desc`, '')}</span>
            {unlocked ? (
              <span className="xsmall success-text">{formatDate(a.unlockedAt!, locale)}</span>
            ) : (
              <div
                className="progress progress-sm"
                role="progressbar"
                aria-label={td(`achievements.${a.id}`, a.id)}
                aria-valuemin={0}
                aria-valuemax={a.target}
                aria-valuenow={a.current}
              >
                <span style={{ width: `${(a.current / a.target) * 100}%` }} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ProgressPage() {
  const { t, td } = useI18n();
  const progress = useProgress();
  const { data: boot } = useBootstrap();
  const update = useUpdateProfile();
  const showError = useErrorToast();
  const { push } = useToast();

  if (progress.isPending)
    return (
      <div className="page">
        <SkeletonList count={3} />
      </div>
    );
  if (progress.isError)
    return (
      <div className="page">
        <ErrorState error={progress.error} onRetry={() => void progress.refetch()} />
      </div>
    );
  const p = progress.data;
  const metCount = p.collections.characters.filter((c) => c.metAt).length;
  const visitedCount = p.collections.worlds.filter((w) => w.visitedAt).length;

  const applyReward = (id: string, type: 'title' | 'accent') =>
    update.mutate(type === 'title' ? { titleReward: id } : { accentReward: id }, {
      onSuccess: () => push('success', t('profile.saved')),
      onError: showError,
    });

  return (
    <div className="page">
      <header className="page-header">
        <div className="titles">
          <h1>{t('progress.title')}</h1>
          <p>{t('progress.subtitle')}</p>
        </div>
      </header>
      <div className="with-rail">
        <div className="stack">
          <section className="card level-card">
            <div className="level-ring" aria-hidden>
              <Trophy />
              <strong>{p.level.level}</strong>
            </div>
            <div className="grow stack-sm">
              <LevelBar level={p.level.level} xp={p.level.xp} current={p.level.currentLevelXp} next={p.level.nextLevelXp} progress={p.level.progress} />
              <span className="small muted">
                {t('progress.xp', { xp: p.level.xp })} · {t('progress.today', { xp: p.todayXp })}
              </span>
            </div>
          </section>

          <section className="card">
            <div className="card-title">
              <h2>
                <Sparkles aria-hidden /> {t('progress.daily')}
              </h2>
              <span className="xsmall faint">{t('progress.dailyHint')}</span>
            </div>
            <ul className="quest-list">
              {p.daily.map((q) => (
                <QuestItem key={q.id} quest={q} />
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="card-title">
              <h2>
                <Trophy aria-hidden /> {t('progress.general')}
              </h2>
            </div>
            <ul className="quest-list">
              {p.general.map((q) => (
                <QuestItem key={q.id} quest={q} />
              ))}
            </ul>
          </section>

          <section className="section">
            <h2>{t('progress.achievements')}</h2>
            <AchievementGrid achievements={p.achievements} />
          </section>

          <section className="section">
            <div className="section-header">
              <h2>
                {t('progress.characterCards')} ({metCount}/{p.collections.characters.length})
              </h2>
            </div>
            <p className="small muted">{t('progress.characterCardsHint')}</p>
            <ul className="collection-grid">
              {p.collections.characters.map((c) => (
                <li key={c.id} className={`collection-card ${c.metAt ? 'owned' : 'locked'}`}>
                  {c.metAt ? (
                    <Link to={`/characters/${c.id}`} className="stack-sm center">
                      <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} size="lg" decorative />
                      <span className="xsmall truncate">{c.name}</span>
                    </Link>
                  ) : (
                    <Link to={`/characters/${c.id}`} className="stack-sm center" aria-label={`${t('progress.locked')}: ${c.name}`}>
                      <span className="locked-avatar">
                        <Lock aria-hidden />
                      </span>
                      <span className="xsmall faint">???</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="section">
            <h2>
              {t('progress.worldStamps')} ({visitedCount}/{p.collections.worlds.length})
            </h2>
            <p className="small muted">{t('progress.worldStampsHint')}</p>
            <ul className="stamp-grid">
              {p.collections.worlds.map((w) => (
                <li key={w.id} className={`stamp ${w.visitedAt ? 'owned' : 'locked'}`}>
                  <Link to={`/worlds/${w.id}`} aria-label={w.visitedAt ? w.name : `${t('progress.locked')}: ${w.name}`}>
                    <WorldArt seed={w.id} style={w.artStyle} hue={w.hue} imageUrl={w.coverUrl} className="stamp-art" />
                    <span className="stamp-label">
                      {w.visitedAt ? <Stamp aria-hidden className="icon-xs" /> : <Lock aria-hidden className="icon-xs" />} {w.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="rail rail-visible-mobile">
          <section className="card">
            <div className="card-title">
              <h2>
                <Palette aria-hidden /> {t('progress.rewards')}
              </h2>
            </div>
            <p className="xsmall muted">{t('progress.rewardsHint')}</p>
            <ul className="reward-list">
              {p.rewards.map((r) => {
                const active = r.type === 'title' ? boot?.profile.titleReward === r.id : boot?.profile.accentReward === r.id;
                return (
                  <li key={r.id} className={`reward ${r.unlocked ? '' : 'locked'}`}>
                    <span className={`reward-swatch ${r.type}`} data-accent={r.type === 'accent' ? r.id : undefined} aria-hidden />
                    <span className="grow">
                      <strong className="small">{td(`rewards.${r.id}`, r.id)}</strong>
                      <span className="xsmall faint block">
                        {r.unlock.type === 'level'
                          ? t('progress.unlockLevel', { level: r.unlock.level })
                          : t('progress.unlockAchievement', { name: td(`achievements.${r.unlock.id}`, r.unlock.id) })}
                      </span>
                    </span>
                    {r.unlocked ? (
                      active ? (
                        <span className="badge badge-success">{t('progress.inUse')}</span>
                      ) : (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyReward(r.id, r.type)} disabled={update.isPending}>
                          {t('progress.use')}
                        </button>
                      )
                    ) : (
                      <Lock aria-label={t('progress.locked')} className="icon-xs faint" />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="card">
            <div className="card-title">
              <h2>{t('progress.xpRules')}</h2>
            </div>
            <p className="xsmall muted">{t('progress.xpRulesHint')}</p>
            <ul className="xp-rules">
              {(Object.entries(XP_RULES) as [XpAction, { xp: number; dailyCap: number }][])
                .filter(([, r]) => r.xp > 0)
                .map(([action, rule]) => (
                  <li key={action} className="row-between xsmall">
                    <span>{td(`xpActions.${action}`, action)}</span>
                    <span className="faint">
                      +{rule.xp} XP · {t('progress.perDay', { count: rule.dailyCap })}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
          <section className="card">
            <div className="card-title">
              <h2>{t('progress.recentXp')}</h2>
            </div>
            {p.recentXp.length === 0 ? (
              <p className="xsmall muted">{t('progress.noXpYet')}</p>
            ) : (
              <ul className="xp-rules">
                {p.recentXp.map((x, i) => (
                  <li key={i} className="row-between xsmall">
                    <span>{td(`xpActions.${x.action}`, x.action)}</span>
                    <span className="success-text">+{x.amount}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
