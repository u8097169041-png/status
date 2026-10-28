import { ArrowLeft, Check, Drama, LogIn, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { LIMITS, type AvatarGlyph } from '../../../shared/constants';
import type { CharacterSummary, JoinWorldInput } from '../../../shared/types';
import { ApiError } from '../api/client';
import { usePlayActions, usePlayers, useWorld } from '../api/hooks';
import { VerifiedBadge } from '../components/play/PlayUI';
import { useErrorToast, useProgressFeedback } from '../components/progress/useProgressFeedback';
import { Avatar } from '../components/ui/Avatar';
import { GlyphPicker, HuePicker, ListEditor, TagInput, TextArea, TextField } from '../components/ui/Form';
import { ConfirmDialog } from '../components/ui/Modal';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { WorldArt } from '../components/ui/WorldArt';
import { useI18n } from '../i18n';

type Mode = 'custom' | 'existing';

function FigureOption({
  character,
  selected,
  previouslyPlayed,
  onSelect,
}: {
  character: CharacterSummary;
  selected: boolean;
  previouslyPlayed: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  return (
    <button type="button" role="radio" aria-checked={selected} className={`figure-option ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <Avatar name={character.name} hue={character.avatarHue} glyph={character.avatarGlyph} size="md" decorative />
      <span className="grow min-w-0">
        <strong className="row small">
          <span className="truncate">{character.name}</span> {character.prominent && <VerifiedBadge />}
        </strong>
        <span className="xsmall muted block clamp-2">{character.role || character.tagline}</span>
        {previouslyPlayed && <span className="xsmall accent block">{t('play.previouslyPlayed')}</span>}
        {character.isRealPersonSim && (
          <span className="badge badge-sim">
            <Drama aria-hidden /> {t('labels.fictionalSim')}
          </span>
        )}
      </span>
      {selected && <Check aria-hidden className="icon-sm accent" />}
    </button>
  );
}

/** Beitritt zu einer Welt: eigene Figur erstellen oder eine Figur der Welt übernehmen. */
export function JoinWorldPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const query = useWorld(id);
  const players = usePlayers(id);
  const { join } = usePlayActions();
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();

  const preselected = params.get('character');
  const [mode, setMode] = useState<Mode>(preselected ? 'existing' : 'custom');
  const [characterId, setCharacterId] = useState<string | null>(preselected);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [background, setBackground] = useState('');
  const [personality, setPersonality] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [hue, setHue] = useState(205);
  const [glyph, setGlyph] = useState<AvatarGlyph>('initials');
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [nameError, setNameError] = useState(false);

  if (query.isPending)
    return (
      <div className="page">
        <SkeletonList count={2} height={200} />
      </div>
    );
  if (query.isError)
    return (
      <div className="page">
        {query.error instanceof ApiError && query.error.status === 404 ? (
          <EmptyState title={t('errors.notFound')} action={<Link to="/discover" className="btn btn-secondary">{t('nav.discover')}</Link>} />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </div>
    );

  const world = query.data.world;
  const active = players.data?.find((p) => p.isActive) ?? null;
  const playedIds = new Set((players.data ?? []).filter((p) => !p.isActive).map((p) => p.character.id));
  // Wählbar sind Figuren der Welt, die keine eigenen Spielfiguren sind und gerade nicht gespielt werden.
  const figures = world.characters
    .filter((c) => !c.isPlayer && c.id !== active?.character.id)
    .sort((a, b) => Number(b.prominent) - Number(a.prominent) || a.name.localeCompare(b.name));

  const buildInput = (): JoinWorldInput | null => {
    if (mode === 'existing') {
      if (!characterId) return null;
      return { mode, characterId, confirmSwitch: Boolean(active) };
    }
    if (!name.trim()) {
      setNameError(true);
      return null;
    }
    return {
      mode,
      character: { name, role, background, personality, goals, avatarHue: hue, avatarGlyph: glyph },
      confirmSwitch: Boolean(active),
    };
  };

  const submit = () => {
    const input = buildInput();
    if (!input) return;
    join.mutate(
      { worldId: world.id, input },
      {
        onSuccess: (r) => {
          setConfirmSwitch(false);
          push('success', t('play.joined', { world: world.name }), t('play.joinedHint'));
          feedback(r.progress);
          navigate('/feed');
        },
        onError: (error) => {
          setConfirmSwitch(false);
          showError(error);
        },
      },
    );
  };

  const ready = mode === 'existing' ? Boolean(characterId) : name.trim().length > 0;

  return (
    <div className="page join-page" style={{ '--world-hue': world.hue } as React.CSSProperties}>
      <Link to={`/worlds/${world.id}`} className="back-link">
        <ArrowLeft aria-hidden /> {world.name}
      </Link>
      <section className="join-hero card">
        <WorldArt seed={world.id} style={world.artStyle} hue={world.hue} className="join-hero-art" />
        <div className="join-hero-text">
          <h1>{t('play.joinTitle')}</h1>
          <p className="muted">{t('play.joinSubtitle', { world: world.name })}</p>
          {active && <p className="notice">{t('play.switchConfirmText', { name: active.character.name })}</p>}
        </div>
      </section>

      <div className="mode-switch" role="radiogroup" aria-label={t('play.joinTitle')}>
        <button type="button" role="radio" aria-checked={mode === 'custom'} className={`mode-option card ${mode === 'custom' ? 'selected' : ''}`} onClick={() => setMode('custom')}>
          <UserPlus aria-hidden />
          <strong>{t('play.modeCustom')}</strong>
          <span className="small muted">{t('play.modeCustomHint')}</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'existing'}
          className={`mode-option card ${mode === 'existing' ? 'selected' : ''}`}
          onClick={() => setMode('existing')}
          disabled={figures.length === 0}
        >
          <Users aria-hidden />
          <strong>{t('play.modeExisting')}</strong>
          <span className="small muted">{t('play.modeExistingHint')}</span>
        </button>
      </div>

      {mode === 'custom' ? (
        <section className="card form-grid" aria-label={t('play.modeCustom')}>
          <div className="form-grid two">
            <div className="stack-sm">
              <TextField label={t('play.name')} value={name} onChange={(v) => { setName(v); setNameError(false); }} max={LIMITS.characterName} required />
              {nameError && (
                <p className="field-error" role="alert">
                  {t('play.nameRequired')}
                </p>
              )}
            </div>
            <TextField label={t('play.role')} value={role} onChange={setRole} max={LIMITS.characterShortText} />
          </div>
          <TextArea label={t('play.background')} value={background} onChange={setBackground} max={LIMITS.characterLongText} rows={3} />
          <TagInput
            label={t('play.personality')}
            hint={t('play.personalityHint')}
            values={personality}
            onChange={setPersonality}
            max={LIMITS.characterListItems}
            maxLength={LIMITS.characterListItem}
          />
          <div className="stack-sm">
            <ListEditor label={t('play.goals')} values={goals} onChange={setGoals} max={LIMITS.playerGoals} maxLength={LIMITS.characterRule} />
            <span className="field-hint">{t('play.goalsHint')}</span>
          </div>
          <div className="form-grid two">
            <HuePicker label={t('profile.avatarColor')} value={hue} onChange={setHue} />
            <GlyphPicker label={t('profile.avatarGlyph')} value={glyph} onChange={setGlyph} hue={hue} name={name || '?'} />
          </div>
        </section>
      ) : (
        <section className="card stack-sm" aria-label={t('play.chooseFigure')}>
          <h2 className="card-heading">{t('play.chooseFigure')}</h2>
          <div className="figure-grid" role="radiogroup" aria-label={t('play.chooseFigure')}>
            {figures.map((c) => (
              <FigureOption
                key={c.id}
                character={c}
                selected={characterId === c.id}
                previouslyPlayed={playedIds.has(c.id)}
                onSelect={() => setCharacterId(c.id)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="row-between join-actions">
        <p className="xsmall faint">{t('discover.fictionNotice')}</p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!ready || join.isPending}
          onClick={() => (active ? setConfirmSwitch(true) : submit())}
        >
          {join.isPending ? <span className="spinner" aria-hidden /> : <LogIn aria-hidden />}
          {join.isPending ? t('play.joining') : active ? t('play.switchAndJoin') : t('play.join')}
        </button>
      </div>

      {confirmSwitch && active && (
        <ConfirmDialog
          title={t('play.switchConfirmTitle')}
          text={t('play.switchConfirmText', { name: active.character.name })}
          confirmLabel={t('play.switchAndJoin')}
          busy={join.isPending}
          onCancel={() => setConfirmSwitch(false)}
          onConfirm={submit}
        />
      )}
    </div>
  );
}
