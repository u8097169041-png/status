import { BadgeCheck, Coins, Compass, Crown, Megaphone, Scale, Users } from 'lucide-react';
import { Link } from 'react-router';
import type { DecisionEffectsDto, PlayerDto } from '../../../../shared/types';
import { useBootstrap } from '../../api/hooks';
import { useI18n } from '../../i18n';
import { formatNumber } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { EmptyState } from '../ui/States';

/** Aktive Welt und Spielfigur aus dem Bootstrap. */
export function useActivePlay() {
  const { data: boot } = useBootstrap();
  return {
    boot,
    worldId: boot?.activeWorld?.id ?? null,
    world: boot?.activeWorld ?? null,
    player: boot?.activePlayer ?? null,
  };
}

export function VerifiedBadge() {
  const { t } = useI18n();
  return (
    <span className="verified" title={t('play.verified')}>
      <BadgeCheck aria-hidden />
      <span className="sr-only">{t('play.verified')}</span>
    </span>
  );
}

export function NotJoinedState() {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={Compass}
      title={t('play.notJoinedTitle')}
      text={t('play.notJoinedText')}
      action={
        <Link to="/discover" className="btn btn-primary">
          <Compass aria-hidden /> {t('play.discoverWorlds')}
        </Link>
      }
    />
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Crown; label: string; value: string }) {
  return (
    <div className="player-stat">
      <Icon aria-hidden />
      <span className="player-stat-value">{value}</span>
      <span className="player-stat-label">{label}</span>
    </div>
  );
}

/** Statusleiste der Spielfigur: Ansehen, Einfluss, Follower, Funken und offene Entscheidungen. */
export function PlayerStatusBar({ player, coins }: { player: PlayerDto; coins: number }) {
  const { t, locale } = useI18n();
  const c = player.character;
  return (
    <section className="player-bar card" aria-label={t('play.statusLabel')}>
      <div className="player-bar-who">
        <Link to="/profile" className="player-bar-avatar" tabIndex={-1} aria-hidden>
          <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} size="md" decorative />
        </Link>
        <span className="min-w-0">
          <Link to="/profile" className="row truncate player-bar-name">
            <strong className="truncate">{c.name}</strong> {c.prominent && <VerifiedBadge />}
          </Link>
          <span className="xsmall muted truncate block">{t('play.playingAs', { name: c.role || c.handle })}</span>
          <Link to="/skills" className="player-level" aria-label={`${t('play.level', { level: player.level.level })} – ${t('nav.skills')}`}>
            <span className="badge badge-player">{t('play.level', { level: player.level.level })}</span>
            <span className="progress progress-sm player-level-bar" aria-hidden>
              <span style={{ width: `${Math.round(player.level.progress * 100)}%` }} />
            </span>
            {player.skillPoints.available > 0 && (
              <span className="badge badge-coins">{t('play.skillPointsFree', { count: player.skillPoints.available })}</span>
            )}
          </Link>
        </span>
      </div>
      <div className="player-stats">
        <Stat icon={Crown} label={t('play.reputation')} value={formatNumber(player.reputation, locale)} />
        <Stat icon={Megaphone} label={t('play.influence')} value={formatNumber(player.influence, locale)} />
        <Stat icon={Users} label={t('play.followers')} value={formatNumber(player.followers, locale)} />
        <Link to="/shop" className="player-stat player-stat-link">
          <Coins aria-hidden />
          <span className="player-stat-value">{formatNumber(coins, locale)}</span>
          <span className="player-stat-label">{t('play.coins')}</span>
        </Link>
      </div>
      {player.pendingDecisions > 0 && (
        <Link to="/tasks" className="btn btn-primary btn-sm player-bar-cta">
          <Scale aria-hidden /> {t('play.pending', { count: player.pendingDecisions })}
        </Link>
      )}
    </section>
  );
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** Transparente Auswirkungen einer Entscheidungsoption. */
export function EffectChips({ effects }: { effects: DecisionEffectsDto }) {
  const { t } = useI18n();
  const chips: { key: string; text: string; tone: 'up' | 'down' | 'neutral' }[] = [];
  const add = (key: string, value: number | undefined, text: (v: string) => string) => {
    if (value) chips.push({ key, text: text(signed(value)), tone: value > 0 ? 'up' : 'down' });
  };
  add('rep', effects.reputation, (value) => t('tasks.effectReputation', { value }));
  add('inf', effects.influence, (value) => t('tasks.effectInfluence', { value }));
  add('fol', effects.followers, (value) => t('tasks.effectFollowers', { value }));
  for (const [metric, value] of Object.entries(effects.metrics ?? {})) {
    add(`m-${metric}`, value, (v) => t('tasks.effectMetric', { metric: t(`metrics.${metric as 'harmony'}`), value: v }));
  }
  for (const a of effects.affinity ?? []) add(`a-${a.characterId}`, a.delta, (value) => t('tasks.effectAffinity', { name: a.name, value }));
  if (effects.advancesStoryline) chips.push({ key: 'story', text: t('tasks.effectStory'), tone: 'neutral' });
  if (chips.length === 0) return <span className="xsmall faint">{t('tasks.effectNone')}</span>;
  return (
    <ul className="effect-chips">
      {chips.map((c) => (
        <li key={c.key} className={`effect-chip ${c.tone}`}>
          {c.text}
        </li>
      ))}
    </ul>
  );
}
