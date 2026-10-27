import { Fragment, useMemo } from 'react';
import { Link } from 'react-router';
import { useCharacters } from '../../api/hooks';

const TOKEN = /(#[\p{L}\p{N}_]{2,30})|(@[A-Za-z0-9_]{2,30})|(https?:\/\/[^\s<>"']+)/gu;

/**
 * Stellt Nutzer- und KI-Text sicher dar: Es wird nie HTML interpretiert.
 * Hashtags, Erwähnungen und http(s)-Links werden als React-Elemente verlinkt.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const { data: characters } = useCharacters();
  const handles = useMemo(() => new Map((characters ?? []).map((c) => [c.handle.toLowerCase(), c.id])), [characters]);
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(<Fragment key={i++}>{text.slice(last, index)}</Fragment>);
    const [token, tag, mention, url] = match;
    if (tag) {
      parts.push(
        <Link key={i++} to={`/feed?tag=${encodeURIComponent(tag.slice(1).toLowerCase())}`} className="rt-tag">
          {tag}
        </Link>,
      );
    } else if (mention) {
      const id = handles.get(mention.slice(1).toLowerCase());
      parts.push(
        id ? (
          <Link key={i++} to={`/characters/${id}`} className="rt-mention">
            {mention}
          </Link>
        ) : (
          <span key={i++} className="rt-mention">
            {mention}
          </span>
        ),
      );
    } else if (url) {
      parts.push(
        <a key={i++} href={url} target="_blank" rel="noopener noreferrer nofollow" className="rt-link">
          {url.length > 48 ? `${url.slice(0, 45)}…` : url}
        </a>,
      );
    } else {
      parts.push(<Fragment key={i++}>{token}</Fragment>);
    }
    last = index + token.length;
  }
  if (last < text.length) parts.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);
  return <p className={`rich-text ${className ?? ''}`}>{parts}</p>;
}
