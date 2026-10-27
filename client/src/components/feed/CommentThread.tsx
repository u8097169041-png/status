import { CornerDownRight, Send, Sparkles, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { LIMITS } from '../../../../shared/constants';
import type { CommentDto } from '../../../../shared/types';
import { useCommentActions } from '../../api/hooks';
import { useI18n } from '../../i18n';
import { useErrorToast, useProgressFeedback } from '../progress/useProgressFeedback';
import { RelativeTime } from '../ui/RelativeTime';
import { RichText } from '../ui/RichText';
import { useToast } from '../ui/Toast';
import { AuthorAvatar, AuthorName } from './AuthorLine';

function CommentItem({
  comment,
  onReply,
  onDelete,
}: {
  comment: CommentDto;
  onReply: (c: CommentDto) => void;
  onDelete: (c: CommentDto) => void;
}) {
  const { t } = useI18n();
  return (
    <li className="comment">
      <AuthorAvatar author={comment.author} size="sm" />
      <div className="comment-body">
        <div className="comment-header">
          <AuthorName author={comment.author} />
          <span className="faint xsmall">
            <RelativeTime iso={comment.createdAt} />
          </span>
          {comment.source === 'ai' && (
            <span className="badge badge-ai">
              <Sparkles aria-hidden />
              {t('source.ai')}
            </span>
          )}
        </div>
        <RichText text={comment.content} />
        <div className="comment-actions">
          <button type="button" className="link-btn xsmall" onClick={() => onReply(comment)}>
            {t('post.reply')}
          </button>
          {comment.isOwn && (
            <button type="button" className="link-btn xsmall danger-link" onClick={() => onDelete(comment)} aria-label={t('post.deleteComment')}>
              <Trash2 aria-hidden /> {t('common.delete')}
            </button>
          )}
        </div>
        {comment.replies.length > 0 && (
          <ul className="comment-replies">
            {comment.replies.map((r) => (
              <CommentItem key={r.id} comment={r} onReply={onReply} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function CommentThread({ postId, comments }: { postId: string; comments: CommentDto[] }) {
  const { t } = useI18n();
  const actions = useCommentActions(postId);
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<CommentDto | null>(null);
  const tooLong = content.length > LIMITS.commentContent;

  const submit = () => {
    if (!content.trim() || tooLong) return;
    actions.add.mutate(
      { content, parentId: replyTo?.id ?? null },
      {
        onSuccess: (r) => {
          setContent('');
          setReplyTo(null);
          push('success', t('post.commentAdded'));
          feedback(r.progress);
        },
        onError: showError,
      },
    );
  };

  return (
    <section className="comments card" aria-label={t('post.comments')}>
      <form
        className="comment-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {replyTo && (
          <div className="replying-to">
            <CornerDownRight aria-hidden />
            {t('post.replyingTo', { name: replyTo.author.name })}
            <button type="button" className="icon-btn" onClick={() => setReplyTo(null)} aria-label={t('common.cancel')}>
              <X />
            </button>
          </div>
        )}
        <div className="row">
          <textarea
            className="textarea comment-input"
            rows={2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={replyTo ? t('post.writeReply', { name: replyTo.author.name }) : t('post.writeComment')}
            aria-label={t('post.writeComment')}
            id="comment-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button type="submit" className="btn btn-primary" disabled={!content.trim() || tooLong || actions.add.isPending} aria-label={t('common.send')}>
            {actions.add.isPending ? <span className="spinner" aria-hidden /> : <Send aria-hidden />}
          </button>
        </div>
        {content.length > LIMITS.commentContent * 0.8 && (
          <span className={`char-count ${tooLong ? 'over' : ''}`}>
            {content.length}/{LIMITS.commentContent}
          </span>
        )}
      </form>
      {comments.length === 0 ? (
        <p className="muted small center-text">{t('post.noComments')}</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              onReply={(target) => {
                setReplyTo(target);
                document.getElementById('comment-input')?.focus();
              }}
              onDelete={(target) => actions.remove.mutate(target.id, { onError: showError })}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
