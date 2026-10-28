import { Bot, Drama, MessageCircle } from 'lucide-react';
import { Link } from 'react-router';
import type { CharacterSummary } from '../../../../shared/types';
import { useI18n } from '../../i18n';
import { VerifiedBadge } from '../play/PlayUI';
import { Avatar, hueGradient } from '../ui/Avatar';

export function CharacterCard({ character, showWorld = true }: { character: CharacterSummary; showWorld?: boolean }) {
  const { t, td } = useI18n();
  return (
    <article className="character-card card-interactive">
      <div className="character-card-banner" style={{ background: hueGradient(character.avatarHue) }} aria-hidden />
      <Link to={`/characters/${character.id}`} className="character-card-link">
        <Avatar name={character.name} hue={character.avatarHue} glyph={character.avatarGlyph} size="lg" ring="muted" decorative />
        <div className="character-card-titles">
          <h3 className="row">
            {character.name} {character.prominent && <VerifiedBadge />}
          </h3>
          <span className="faint xsmall">@{character.handle}</span>
        </div>
      </Link>
      <div className="row wrap character-card-badges">
        <span className="badge badge-ai">
          <Bot aria-hidden />
          {t('labels.aiCharacter')}
        </span>
        {character.isRealPersonSim && (
          <span className="badge badge-sim" title={t('labels.fictionalSimHint')}>
            <Drama aria-hidden />
            {t('labels.fictionalSim')}
          </span>
        )}
        {character.isCustom && !character.isPlayer && <span className="badge badge-demo">{t('labels.custom')}</span>}
        {(character.isPlayer || character.playedByYou) && <span className="badge badge-player">{t('play.playerBadge')}</span>}
      </div>
      <p className="small muted clamp-2">{character.tagline}</p>
      <div className="row-between character-card-footer">
        <span className="xsmall faint truncate">
          {character.role}
          {showWorld && ` · ${character.worldName ?? t('characters.noWorld')}`}
          {` · ${td(`moods.${character.mood}`, character.mood)}`}
        </span>
        {!character.isPlayer && !character.playedByYou && (
          <Link to={`/chats/${character.id}`} className="btn btn-secondary btn-sm" aria-label={`${t('characters.chat')}: ${character.name}`}>
            <MessageCircle aria-hidden /> {t('characters.chat')}
          </Link>
        )}
      </div>
    </article>
  );
}
