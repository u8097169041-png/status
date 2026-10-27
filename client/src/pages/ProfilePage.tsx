import { Edit3, Lock, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { LIMITS } from '../../../shared/constants';
import type { UserProfileDto } from '../../../shared/types';
import { useBootstrap, useProgress, useUpdateProfile } from '../api/hooks';
import { FeedList } from '../components/feed/FeedList';
import { LevelBar } from '../components/progress/QuestItem';
import { useErrorToast } from '../components/progress/useProgressFeedback';
import { Avatar, hueGradient } from '../components/ui/Avatar';
import { GlyphPicker, HuePicker, SelectField, Tabs, TextArea, TextField } from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';
import { Loading } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { formatDate } from '../lib/format';
import { AchievementGrid } from './ProgressPage';

type Tab = 'posts' | 'bookmarks' | 'achievements';

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

export function ProfilePage() {
  const { t, td, locale } = useI18n();
  const { data: boot } = useBootstrap();
  const { data: progress } = useProgress();
  const [tab, setTab] = useState<Tab>('posts');
  const [editing, setEditing] = useState(false);
  if (!boot) return <Loading />;
  const p = boot.profile;
  return (
    <div className="page page-narrow">
      <section className="profile-header card">
        <div className="profile-banner" style={{ background: hueGradient(p.avatarHue) }} aria-hidden />
        <div className="profile-head">
          <Avatar name={p.displayName} hue={p.avatarHue} glyph={p.avatarGlyph} size="xxl" ring />
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
          { id: 'bookmarks', label: t('profile.tabBookmarks') },
          { id: 'achievements', label: t('profile.tabAchievements') },
        ]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="stack tab-panel">
        {tab === 'posts' && <FeedList filters={{ author: 'user' }} emptyText={t('profile.postsEmpty')} />}
        {tab === 'bookmarks' && <FeedList filters={{ bookmarked: true }} emptyText={t('profile.bookmarksEmpty')} />}
        {tab === 'achievements' && progress && <AchievementGrid achievements={progress.achievements} />}
      </div>
      {editing && <EditProfileModal profile={p} onClose={() => setEditing(false)} />}
    </div>
  );
}
