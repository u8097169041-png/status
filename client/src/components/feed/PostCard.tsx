import { Bookmark, Heart, MessageCircle, MoreHorizontal, Pencil, Quote, Repeat2, Sparkles, Trash2, Undo2, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { LIMITS } from '../../../../shared/constants';
import type { PostDto } from '../../../../shared/types';
import { usePostActions } from '../../api/hooks';
import { useI18n } from '../../i18n';
import { useErrorToast, useProgressFeedback } from '../progress/useProgressFeedback';
import { Menu } from '../ui/Menu';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { RelativeTime } from '../ui/RelativeTime';
import { RichText } from '../ui/RichText';
import { useToast } from '../ui/Toast';
import { AuthorAvatar, AuthorName } from './AuthorLine';

function SourceBadge({ source }: { source: PostDto['source'] }) {
  const { t } = useI18n();
  if (source === 'ai') {
    return (
      <span className="badge badge-ai" title={t('source.ai')}>
        <Sparkles aria-hidden />
        {t('source.ai')}
      </span>
    );
  }
  if (source === 'sim' || source === 'demo') {
    return <span className="badge">{t(`source.${source}`)}</span>;
  }
  return null;
}

function EmbeddedPost({ post }: { post: PostDto }) {
  return (
    <Link to={`/posts/${post.id}`} className="post-embed">
      <div className="row">
        <AuthorName author={post.author} />
      </div>
      <RichText text={post.content} />
    </Link>
  );
}

export function PostCard({ post, compact }: { post: PostDto; compact?: boolean }) {
  const { t } = useI18n();
  const actions = usePostActions();
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quote, setQuote] = useState('');

  const isPureRepost = Boolean(post.repostOf) && !post.content;
  // Bei reinen Reposts beziehen sich die Aktionen auf den Originalbeitrag.
  const target = isPureRepost && post.repostOf ? post.repostOf : post;

  const like = () =>
    actions.like.mutate({ id: target.id, liked: !target.likedByMe }, { onSuccess: (r) => feedback(r.progress), onError: showError });
  const bookmark = () =>
    actions.bookmark.mutate(
      { id: target.id, saved: !target.bookmarkedByMe },
      {
        onSuccess: (r) => {
          feedback(r.progress);
          if (r.post.bookmarkedByMe) push('success', t('post.bookmarked'));
        },
        onError: showError,
      },
    );
  const doRepost = (content?: string) =>
    actions.repost.mutate(
      { id: target.id, content },
      {
        onSuccess: (r) => {
          feedback(r.progress);
          push('success', t('post.reposted'));
          setQuoteOpen(false);
          setQuote('');
        },
        onError: showError,
      },
    );

  return (
    <article className={`post-card card ${compact ? 'compact' : ''}`} aria-labelledby={`post-${post.id}-author`}>
      {isPureRepost && (
        <div className="repost-line">
          <Repeat2 aria-hidden /> {t('post.repostedBy', { name: post.author.name })}
        </div>
      )}
      <div className="post-main">
        <AuthorAvatar author={target.author} />
        <div className="post-body">
          <header className="post-header">
            <div className="post-meta" id={`post-${post.id}-author`}>
              <AuthorName author={target.author} />
              <span className="post-sub">
                <Link to={`/posts/${target.id}`} className="post-time">
                  <RelativeTime iso={target.createdAt} />
                </Link>
                {target.editedAt && <span className="faint">· {t('post.edited')}</span>}
                {target.worldId && target.worldName && (
                  <Link to={`/worlds/${target.worldId}`} className="world-chip" style={{ '--chip-hue': target.worldHue ?? 260 } as React.CSSProperties}>
                    {target.worldName}
                  </Link>
                )}
                {target.eventId && (
                  <span className="badge" title={t('post.fromEvent')}>
                    <Zap aria-hidden />
                    {t('post.fromEvent')}
                  </span>
                )}
                <SourceBadge source={target.source} />
              </span>
            </div>
            {post.isOwn && !isPureRepost && (
              <Menu
                label={t('post.options')}
                trigger={<MoreHorizontal />}
                items={[
                  { label: t('post.edit'), icon: <Pencil />, onSelect: () => (setDraft(post.content), setEditing(true)) },
                  { label: t('post.delete'), icon: <Trash2 />, danger: true, onSelect: () => setConfirmDelete(true) },
                ]}
              />
            )}
          </header>

          {editing ? (
            <form
              className="stack-sm"
              onSubmit={(e) => {
                e.preventDefault();
                actions.update.mutate(
                  { id: post.id, content: draft },
                  { onSuccess: () => setEditing(false), onError: showError },
                );
              }}
            >
              <textarea className="textarea" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={t('post.edit')} autoFocus />
              <div className="row-between">
                <span className={`char-count ${draft.length > LIMITS.postContent ? 'over' : ''}`}>
                  {draft.length}/{LIMITS.postContent}
                </span>
                <div className="row">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={actions.update.isPending || draft.length > LIMITS.postContent}>
                    {t('common.save')}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            target.content && <RichText text={target.content} className="post-content" />
          )}

          {!isPureRepost && post.repostOf && <EmbeddedPost post={post.repostOf} />}
          {post.repostOfDeleted && !post.repostOf && <p className="post-embed muted">{t('post.originalDeleted')}</p>}

          <footer className="post-actions">
            <Link to={`/posts/${target.id}`} className="action" aria-label={`${t('post.comments')}: ${target.commentCount}`}>
              <MessageCircle aria-hidden />
              <span>{target.commentCount}</span>
            </Link>
            <Menu
              label={`${t('post.repost')} (${target.repostCount})`}
              align="start"
              triggerClassName={`action ${target.repostedByMe ? 'reposted' : ''}`}
              trigger={
                <>
                  <Repeat2 aria-hidden />
                  <span>{target.repostCount}</span>
                </>
              }
              items={
                target.repostedByMe
                  ? [{ label: t('post.undoRepost'), icon: <Undo2 />, onSelect: () => actions.undoRepost.mutate(target.id, { onError: showError }) }]
                  : [
                      { label: t('post.repost'), icon: <Repeat2 />, onSelect: () => doRepost() },
                      { label: t('post.quote'), icon: <Quote />, onSelect: () => setQuoteOpen(true) },
                    ]
              }
            />
            <button
              type="button"
              className={`action ${target.likedByMe ? 'liked' : ''}`}
              aria-pressed={target.likedByMe}
              aria-label={`${target.likedByMe ? t('post.unlike') : t('post.like')} (${target.likeCount})`}
              onClick={like}
              disabled={actions.like.isPending}
            >
              <Heart aria-hidden />
              <span>{target.likeCount}</span>
            </button>
            <button
              type="button"
              className={`action ${target.bookmarkedByMe ? 'saved' : ''}`}
              aria-pressed={target.bookmarkedByMe}
              aria-label={target.bookmarkedByMe ? t('post.unbookmark') : t('post.bookmark')}
              onClick={bookmark}
              disabled={actions.bookmark.isPending}
            >
              <Bookmark aria-hidden />
            </button>
          </footer>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t('post.delete')}
          text={t('post.confirmDelete')}
          confirmLabel={t('common.delete')}
          danger
          busy={actions.remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            actions.remove.mutate(post.id, {
              onSuccess: () => {
                setConfirmDelete(false);
                push('success', t('post.deleted'));
              },
              onError: showError,
            })
          }
        />
      )}
      {quoteOpen && (
        <Modal
          title={t('post.quote')}
          onClose={() => setQuoteOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setQuoteOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={actions.repost.isPending || quote.length > LIMITS.postContent}
                onClick={() => doRepost(quote)}
              >
                <Repeat2 /> {t('post.repost')}
              </button>
            </>
          }
        >
          <textarea
            className="textarea"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder={t('post.quotePlaceholder')}
            aria-label={t('post.quotePlaceholder')}
            data-autofocus
          />
          <EmbeddedPost post={target} />
        </Modal>
      )}
    </article>
  );
}
