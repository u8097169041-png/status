import { Bot, Drama } from 'lucide-react';
import { Link } from 'react-router';
import type { AuthorRef } from '../../../../shared/types';
import { useI18n } from '../../i18n';
import { VerifiedBadge } from '../play/PlayUI';
import { Avatar } from '../ui/Avatar';

export function authorLink(author: AuthorRef): string {
  return author.type === 'user' ? '/profile' : `/characters/${author.id}`;
}

export function AuthorAvatar({ author, size = 'md' }: { author: AuthorRef; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <Link to={authorLink(author)} tabIndex={-1} aria-hidden>
      <Avatar name={author.name} hue={author.avatarHue} glyph={author.avatarGlyph} size={size} decorative />
    </Link>
  );
}

/** Name, Handle und Kennzeichnung (KI-Charakter / fiktive Simulation). */
export function AuthorName({ author }: { author: AuthorRef }) {
  const { t } = useI18n();
  return (
    <span className="author-name">
      <Link to={authorLink(author)} className="name">
        {author.name}
      </Link>
      {author.verified && <VerifiedBadge />}
      {author.type === 'character' && (
        <span className="badge badge-ai" title={t('labels.aiCharacter')}>
          <Bot aria-hidden />
          <span>KI</span>
          <span className="sr-only">{t('labels.aiCharacter')}</span>
        </span>
      )}
      {author.isRealPersonSim && (
        <span className="badge badge-sim" title={t('labels.fictionalSimHint')}>
          <Drama aria-hidden />
          {t('labels.fictionalSim')}
        </span>
      )}
      <span className="handle">@{author.handle}</span>
    </span>
  );
}
