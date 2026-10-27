import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { LIMITS, STORY_STYLES } from '../../../../shared/constants';
import type { StoryDto } from '../../../../shared/types';
import { useBootstrap, useStories, useStoryActions } from '../../api/hooks';
import { useI18n } from '../../i18n';
import { durationUntil } from '../../lib/format';
import { useErrorToast, useProgressFeedback } from '../progress/useProgressFeedback';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { RelativeTime } from '../ui/RelativeTime';
import { useToast } from '../ui/Toast';
import { AuthorName } from './AuthorLine';

interface StoryGroup {
  key: string;
  stories: StoryDto[];
  seen: boolean;
}

function groupStories(stories: StoryDto[]): StoryGroup[] {
  const map = new Map<string, StoryDto[]>();
  for (const s of stories) {
    const key = s.author.type === 'user' ? 'user' : (s.author.id ?? s.id);
    map.set(key, [...(map.get(key) ?? []), s]);
  }
  return [...map.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { key, stories: sorted, seen: sorted.every((s) => s.seen) };
    })
    .sort((a, b) => Number(a.seen) - Number(b.seen));
}

function StoryCreateModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { create } = useStoryActions();
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const [content, setContent] = useState('');
  const [style, setStyle] = useState(0);
  return (
    <Modal
      title={t('stories.create')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!content.trim() || content.length > LIMITS.storyContent || create.isPending}
            onClick={() =>
              create.mutate(
                { content, style },
                {
                  onSuccess: (r) => {
                    push('success', t('stories.published'));
                    feedback(r.progress);
                    onClose();
                  },
                  onError: showError,
                },
              )
            }
          >
            {t('stories.publish')}
          </button>
        </>
      }
    >
      <div className={`story-preview story-bg-${style}`}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('stories.placeholder')}
          aria-label={t('stories.placeholder')}
          maxLength={LIMITS.storyContent + 20}
          data-autofocus
        />
      </div>
      <div className="row-between">
        <div className="row" role="radiogroup" aria-label={t('stories.style')}>
          {Array.from({ length: STORY_STYLES }, (_, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={style === i}
              aria-label={`${t('stories.style')} ${i + 1}`}
              className={`story-swatch story-bg-${i} ${style === i ? 'selected' : ''}`}
              onClick={() => setStyle(i)}
            />
          ))}
        </div>
        <span className={`char-count ${content.length > LIMITS.storyContent ? 'over' : ''}`}>
          {content.length}/{LIMITS.storyContent}
        </span>
      </div>
    </Modal>
  );
}

const STORY_DURATION_MS = 6000;

function StoryViewer({ groups, startIndex, onClose }: { groups: StoryGroup[]; startIndex: number; onClose: () => void }) {
  const { t, locale } = useI18n();
  const { view, remove } = useStoryActions();
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  const next = () => {
    if (!group) return onClose();
    if (storyIndex < group.stories.length - 1) setStoryIndex(storyIndex + 1);
    else if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setStoryIndex(0);
    } else onClose();
  };
  const prev = () => {
    if (storyIndex > 0) setStoryIndex(storyIndex - 1);
    else if (groupIndex > 0) {
      setGroupIndex(groupIndex - 1);
      setStoryIndex(0);
    }
  };

  useEffect(() => {
    if (story && !story.seen && !story.isOwn) view.mutate(story.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  useEffect(() => {
    if (paused || !story) return;
    const timer = setTimeout(next, STORY_DURATION_MS);
    return () => clearTimeout(timer);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!story || !group) return null;

  return createPortal(
    <div className="story-viewer" role="dialog" aria-modal="true" aria-label={t('stories.viewer', { name: story.author.name })}>
      <div className={`story-frame story-bg-${story.style}`} onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)}>
        <div className="story-progress">
          {group.stories.map((s, i) => (
            <span key={s.id} className={i < storyIndex ? 'done' : i === storyIndex ? (paused ? 'active paused' : 'active') : ''}>
              <span style={{ animationDuration: `${STORY_DURATION_MS}ms` }} />
            </span>
          ))}
        </div>
        <div className="story-head">
          <Avatar name={story.author.name} hue={story.author.avatarHue} glyph={story.author.avatarGlyph} size="sm" decorative />
          <div className="grow">
            <AuthorName author={story.author} />
            <span className="xsmall story-time">
              <RelativeTime iso={story.createdAt} /> · {t('stories.expiresIn', { time: durationUntil(story.expiresAt, locale) })}
            </span>
          </div>
          {story.isOwn && (
            <button
              type="button"
              className="icon-btn"
              aria-label={t('common.delete')}
              onClick={() => remove.mutate(story.id, { onSuccess: onClose })}
            >
              <Trash2 />
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <X />
          </button>
        </div>
        <p className="story-text">{story.content}</p>
        <button type="button" className="story-nav prev" onClick={prev} aria-label={t('stories.previous')}>
          <ChevronLeft />
        </button>
        <button type="button" className="story-nav next" onClick={next} aria-label={t('stories.next')}>
          <ChevronRight />
        </button>
      </div>
    </div>,
    document.body,
  );
}

export function StoriesBar() {
  const { t } = useI18n();
  const { data: stories } = useStories();
  const { data: boot } = useBootstrap();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const groups = useMemo(() => groupStories(stories ?? []), [stories]);
  const ownIndex = groups.findIndex((g) => g.key === 'user');

  return (
    <section className="stories-bar" aria-label={t('stories.title')}>
      <div className="story-bubble">
        <button
          type="button"
          className="story-ring add"
          onClick={() => (ownIndex >= 0 ? setViewing(ownIndex) : setCreating(true))}
          aria-label={ownIndex >= 0 ? t('stories.yours') : t('stories.create')}
        >
          {boot && <Avatar name={boot.profile.displayName} hue={boot.profile.avatarHue} glyph={boot.profile.avatarGlyph} size="lg" decorative />}
        </button>
        <button type="button" className="story-add" onClick={() => setCreating(true)} aria-label={t('stories.create')}>
          <Plus />
        </button>
        <span className="story-name">{t('stories.yours')}</span>
      </div>
      {groups
        .map((g, index) => ({ g, index }))
        .filter(({ g }) => g.key !== 'user')
        .map(({ g, index }) => {
          const author = g.stories[0].author;
          return (
            <div className="story-bubble" key={g.key}>
              <button
                type="button"
                className={`story-ring ${g.seen ? 'seen' : ''}`}
                onClick={() => setViewing(index)}
                aria-label={t('stories.viewer', { name: author.name })}
              >
                <Avatar name={author.name} hue={author.avatarHue} glyph={author.avatarGlyph} size="lg" decorative />
              </button>
              <span className="story-name">{author.name.split(' ')[0]}</span>
            </div>
          );
        })}
      {creating && <StoryCreateModal onClose={() => setCreating(false)} />}
      {viewing !== null && <StoryViewer groups={groups} startIndex={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
