import { Send } from 'lucide-react';
import { useId, useState } from 'react';
import { LIMITS } from '../../../../shared/constants';
import { useBootstrap, useCreatePost } from '../../api/hooks';
import { useI18n } from '../../i18n';
import { useErrorToast, useProgressFeedback } from '../progress/useProgressFeedback';
import { Avatar } from '../ui/Avatar';
import { useToast } from '../ui/Toast';

/** Beiträge entstehen immer in einer Welt – als die dort aktive Spielfigur. */
export function PostComposer({ worldId }: { worldId: string }) {
  const { t } = useI18n();
  const { data: boot } = useBootstrap();
  const create = useCreatePost();
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const [content, setContent] = useState('');
  const id = useId();
  const me = boot?.activePlayer?.worldId === worldId ? boot.activePlayer : null;
  const worldName = me?.worldName;
  const tooLong = content.length > LIMITS.postContent;

  const submit = () => {
    if (!content.trim() || tooLong) return;
    create.mutate(
      { content, worldId },
      {
        onSuccess: (r) => {
          setContent('');
          push('success', t('composer.posted'), t('composer.hint'));
          feedback(r.progress);
        },
        onError: showError,
      },
    );
  };

  return (
    <form
      className="composer card"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {me && <Avatar name={me.character.name} hue={me.character.avatarHue} glyph={me.character.avatarGlyph} decorative />}
      <div className="composer-body">
        <label htmlFor={id} className="sr-only">
          {t('composer.placeholder')}
        </label>
        <textarea
          id={id}
          className="composer-input"
          rows={2}
          value={content}
          placeholder={worldName ? t('composer.placeholderWorld', { world: worldName }) : t('composer.placeholder')}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="composer-footer">
          <span className="xsmall muted truncate">{me ? t('play.postingAs', { name: me.character.name }) : ''}</span>
          <div className="row">
            {content.length > 0 && (
              <span className={`char-count ${tooLong ? 'over' : ''}`}>
                {content.length}/{LIMITS.postContent}
              </span>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={!content.trim() || tooLong || create.isPending}>
              {create.isPending ? <span className="spinner" aria-hidden /> : <Send aria-hidden />}
              {create.isPending ? t('composer.posting') : t('composer.post')}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
