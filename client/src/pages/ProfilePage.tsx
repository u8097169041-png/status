import { Edit3, Globe2, Lock, Play, Repeat, Target, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { LIMITS } from '../../../shared/constants';
import type { PlayerDto, UserProfileDto } from '../../../shared/types';
import { usePlayActions, usePlayers, useBootstrap, useProgress, useUpdateProfile } from '../api/hooks';
import { PlayerStatusBar, VerifiedBadge } from '../components/play/PlayUI';
import { FeedList } from '../components/feed/FeedList';
import { LevelBar } from '../components/progress/QuestItem';
import { useErrorToast } from '../components/progress/useProgressFeedback';
import { RelativeTime } from '../components/ui/RelativeTime';
import { Avatar, hueGradient } from '../components/ui/Avatar';
import { GlyphPicker, HuePicker, SelectField, Tabs, TextArea, TextField } from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';
import { EmptyState, Loading } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { formatDate } from '../lib/format';
import { AchievementGrid } from './ProgressPage';

type Tab = 'posts' | 'characters' | 'bookmarks' | 'achievements';

function EditProfileModal({ profile, onClose }: { profile: UserProfileDto; onClose: () => void }) {
  const { t, td } = useI18n();
  const update = useUpdateProfile();
  const { data: progress } = useProgress();
  const showError = useErrorToast();
  const { push } = useToast();
  const [p, setP] = useState(profile);
  const set = <K extends keyof UserProfileDto>(key: K, value: UserProfileDto[K]) => setP((prev) => ({ ...prev, [key]: value }));
  const titles = progress?.rewards.filter((r) => r.type === 'title' && r.unlocked) ?? [];
  const accents = progress?.rewards.filter((r) => r.type === 'accent' && r.unlocked) ?? [];
  const handleValid = /^[a-z0-9_]{2,30}$/i.test(p.handle);
  return (
    <Modal
      title={t('profile.edit')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!p.displayName.trim() || !handleValid || p.bio.length > LIMITS.profileBio || update.isPending}
            onClick={() =>
              update.mutate(
                {
                  displayName: p.displayName,
                  handle: p.handle,
                  bio: p.bio,
                  avatarHue: p.avatarHue,
                  avatarGlyph: p.avatarGlyph,
                  titleReward: p.titleReward,
                  accentReward: p.accentReward,
                },
                {
                  onSuccess: () => {
                    push('success', t('profile.saved'));
                    onClose();
                  },
                  onError: showError,
                },
              )
            }
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="row">
        <Avatar name={p.displayName || '?'} hue={p.avatarHue} glyph={p.avatarGlyph} size="xl" decorative />
        <div className="grow stack-sm">
          <TextField label={t('profile.displayName')} value={p.displayName} onChange={(v) => set('displayName', v)} max={LIMITS.profileName} />
          <TextField label={t('profile.handle')} value={p.handle} onChange={(v) => set('handle', v.replace(/^@/, ''))} max={LIMITS.characterHandle} />
          {!handleValid && <span className="field-error">{t('characterForm.handleHint')}</span>}
        </div>
      </div>
      <TextArea label={t('profile.bio')} value={p.bio} onChange={(v) => set('bio', v)} max={LIMITS.profileBio} rows={3} />
      <HuePicker label={t('profile.avatarColor')} value={p.avatarHue} onChange={(v) => set('avatarHue', v)} />
      <GlyphPicker label={t('profile.avatarGlyph')} value={p.avatarGlyph} onChange={(v) => set('avatarGlyph', v)} hue={p.avatarHue} name={p.displayName} />
      <div className="form-grid two">
        <SelectField
          label={t('profile.titleReward')}
          value={p.titleReward}
          onChange={(v) => set('titleReward', v)}
          options={titles.map((r) => ({ value: r.id, label: td(`rewards.${r.id}`, r.id) }))}
        />
        <SelectField
          label={t('profile.accentReward')}
          value={p.accentReward}
          onChange={(v) => set('accentReward', v)}
          options={accents.map((r) => ({ value: r.id, label: td(`rewards.${r.id}`, r.id) }))}
        />
      </div>
      <p className="xsmall faint row">
        <Lock aria-hidden className="icon-xs" /> {t('progress.rewardsHint')}
      </p>
    </Modal>
  );
}

/** Alle Spielfiguren mit Spielverlauf; pausierte Figuren können wieder aufgenommen werden. */
function PlayerList() {
  const { t, locale } = useI18n();
  const players = usePlayers();
  const { activate } = usePlayActions();
  const showError = useErrorToast();
  const { push } = useToast();
  if (players.isPending) return <Loading />;
  const list = players.data ?? [];
  if (list.length === 0)
    return (
      <EmptyState
        icon={Globe2}
        title={t('play.yourCharactersEmpty')}
        action={
          <Link to="/discover" className="btn btn-primary">
            {t('play.discoverWorlds')}
          </Link>
        }
      />
    );
  return (
    <ul className="player-list">
      {list.map((pl: PlayerDto) => (
        <li key={pl.id} className={`player-row card card-tight ${pl.isActive ? 'active' : ''}`} style={{ '--world-hue': pl.worldHue } as React.CSSProperties}>
          <Avatar name={pl.character.name} hue={pl.character.avatarHue} glyph={pl.character.avatarGlyph} size="md" decorative />
          <span className="grow min-w-0">
            <strong className="row small">
              <span className="truncate">{pl.character.name}</span> {pl.character.prominent && <VerifiedBadge />}
            </strong>
            <span className="xsmall muted block truncate">
              {pl.worldName} · {pl.isActive ? t('play.active') : t('play.paused')} · {t('play.joinedAt', { date: formatDate(pl.joinedAt, locale) })}
            </span>
            <span className="xsmall faint block">
              {t('play.reputation')} {pl.reputation} · {t('play.influence')} {pl.influence} · {t('play.followers')} {pl.followers} ·{' '}
              <RelativeTime iso={pl.lastActiveAt} />
            </span>
          </span>
          {pl.isActive ? (
            <Link to={`/worlds/${pl.worldId}/join`} className="btn btn-ghost btn-sm">
              <Repeat aria-hidden /> {t('play.changeCharacter')}
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={activate.isPending}
              onClick={() =>
                activate.mutate(pl.id, { onSuccess: () => push('success', t('play.activated', { name: pl.character.name })), onError: showError })
              }
            >
              <Play aria-hidden /> {t('play.activate')}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ProfilePage() {
  const { t, td, locale } = useI18n();
  const { data: boot } = useBootstrap();
  const { data: progress } = useProgress();
  const [tab, setTab] = useState<Tab>('posts');
  const [editing, setEditing] = useState(false);
  if (!boot) return <Loading />;
  const p = boot.profile;
  const player = boot.activePlayer;
  const me = player?.character;
  return (
    <div className="page page-narrow stack">
      {player && me && (
        <section className="profile-header card" aria-label={t('play.statusLabel')}>
          <div
            className={`profile-banner ${p.bannerItem}`}
            style={p.bannerItem ? undefined : { background: hueGradient(me.avatarHue) }}
            aria-hidden
          />
          <div className="profile-head">
            <span className={`avatar-frame-wrap ${p.frameItem}`}>
              <Avatar name={me.name} hue={me.avatarHue} glyph={me.avatarGlyph} size="xxl" ring />
            </span>
            <div className="profile-actions">
              <Link to={`/worlds/${player.worldId}/join`} className="btn btn-secondary">
                <Repeat aria-hidden /> {t('play.changeCharacter')}
              </Link>
            </div>
          </div>
          <div className="profile-info">
            <h1 className="row">
              {me.name} {me.prominent && <VerifiedBadge />}
            </h1>
            <div className="row wrap">
              <span className="muted">@{me.handle}</span>
              <span className="badge badge-player">{t('play.playerBadge')}</span>
              <span className="badge">{player.worldName}</span>
            </div>
            {me.role && <p className="profile-tagline">{me.role}</p>}
            {me.background && <p className="small muted pre-line">{me.background}</p>}
            {me.goals.length > 0 && (
              <div className="stack-xs">
                <strong className="small row">
                  <Target aria-hidden className="icon-xs accent" /> {t('play.figureGoals')}
                </strong>
                <ul className="rule-list">
                  {me.goals.map((g, i) => (
                    <li key={i} className="small muted">
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
      {player && <PlayerStatusBar player={player} coins={boot.coins} />}
      <section className={`profile-header card ${player ? 'no-banner' : ''}`}>
        {!player && (
          <div
            className={`profile-banner ${p.bannerItem}`}
            style={p.bannerItem ? undefined : { background: hueGradient(p.avatarHue) }}
            aria-hidden
          />
        )}
        <div className="profile-head">
          <span className={`avatar-frame-wrap ${p.frameItem}`}>
            <Avatar name={p.displayName} hue={p.avatarHue} glyph={p.avatarGlyph} size={player ? 'xl' : 'xxl'} ring />
          </span>
          <div className="profile-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
              <Edit3 aria-hidden /> {t('profile.edit')}
            </button>
          </div>
        </div>
        <div className="profile-info">
          <h1>{p.displayName}</h1>
          <div className="row wrap">
            <span className="muted">@{p.handle}</span>
            <span className="badge badge-demo">{td(`rewards.${p.titleReward}`, p.titleReward)}</span>
          </div>
          {p.bio && <p className="profile-tagline">{p.bio}</p>}
          <p className="xsmall faint">
            {t('profile.memberSince', { date: formatDate(p.createdAt, locale) })} · {t('profile.localProfile')}
          </p>
          <LevelBar level={boot.level.level} xp={boot.level.xp} current={boot.level.currentLevelXp} next={boot.level.nextLevelXp} progress={boot.level.progress} />
          <Link to="/progress" className="small row">
            <Trophy aria-hidden className="icon-xs" /> {t('profile.viewProgress')}
          </Link>
        </div>
      </section>
      <Tabs<Tab>
        label={t('profile.title')}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'posts', label: t('profile.tabPosts') },
          { id: 'characters', label: t('play.yourCharacters') },
          { id: 'bookmarks', label: t('profile.tabBookmarks') },
          { id: 'achievements', label: t('profile.tabAchievements') },
        ]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="stack tab-panel">
        {tab === 'posts' &&
          (player ? (
            <FeedList filters={{ player: player.id }} emptyText={t('profile.postsEmpty')} />
          ) : (
            <FeedList filters={{ author: 'user' }} emptyText={t('profile.postsEmpty')} />
          ))}
        {tab === 'characters' && <PlayerList />}
        {tab === 'bookmarks' && <FeedList filters={{ bookmarked: true }} emptyText={t('profile.bookmarksEmpty')} />}
        {tab === 'achievements' && progress && <AchievementGrid achievements={progress.achievements} />}
      </div>
      {editing && <EditProfileModal profile={p} onClose={() => setEditing(false)} />}
    </div>
  );
}
