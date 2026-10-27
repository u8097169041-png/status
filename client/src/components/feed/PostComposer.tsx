import { Send } from 'lucide-react';
import { useId, useState } from 'react';
import { LIMITS } from '../../../../shared/constants';
import { useBootstrap, useCreatePost, useWorlds } from '../../api/hooks';
import { useI18n } from '../../i18n';
import { useErrorToast, useProgressFeedback } from '../progress/useProgressFeedback';
import { Avatar } from '../ui/Avatar';
import { useToast } from '../ui/Toast';

export function PostComposer({ defaultWorldId = null, lockWorld }: { defaultWorldId?: string | null; lockWorld?: boolean }) {
  const { t } = useI18n();
  const { data: boot } = useBootstrap();
  const { data: worlds } = useWorlds();
  const create = useCreatePost();
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const [content, setContent] = useState('');
  const [worldId, setWorldId] = useState<string | null>(defaultWorldId);
  const id = useId();
  const worldName = worlds?.find((w) => w.id === worldId)?.name;
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
      {boot && <Avatar name={boot.profile.displayName} hue={boot.profile.avatarHue} glyph={boot.profile.avatarGlyph} decorative />}
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
          {!lockWorld ? (
            <select
              className="select select-sm"
              value={worldId ?? ''}
              onChange={(e) => setWorldId(e.target.value || null)}
              aria-label={t('composer.worldLabel')}
            >
              <option value="">{t('composer.noWorld')}</option>
              {worlds?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          ) : (
            <span />
          )}
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
