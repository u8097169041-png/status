import { ArrowLeft, Dices, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ART_STYLES, GENRES, LIMITS, type Genre } from '../../../shared/constants';
import type { CharacterInput, WorldDraft, WorldInput } from '../../../shared/types';
import { useAiStatus, useWorld, useWorldActions, useWorldGenerator } from '../api/hooks';
import { useErrorToast, useProgressFeedback } from '../components/progress/useProgressFeedback';
import { Avatar } from '../components/ui/Avatar';
import { HuePicker, ListEditor, SelectField, TextArea, TextField, Toggle } from '../components/ui/Form';
import { ErrorState, Loading } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { WorldArt } from '../components/ui/WorldArt';
import { useI18n } from '../i18n';

type DraftCharacter = Omit<CharacterInput, 'worldId'>;

function WorldFields({ world, onChange }: { world: WorldInput; onChange: (w: WorldInput) => void }) {
  const { t, td } = useI18n();
  const set = <K extends keyof WorldInput>(key: K, value: WorldInput[K]) => onChange({ ...world, [key]: value });
  return (
    <div className="world-form">
      <div className="world-form-preview card">
        <WorldArt seed={world.name || 'preview'} style={world.artStyle} hue={world.hue} className="world-preview-art" label={t('generator.preview')} />
        <div className="form-grid two">
          <SelectField
            label={t('generator.artStyle')}
            value={world.artStyle}
            onChange={(v) => set('artStyle', v)}
            options={ART_STYLES.map((s) => ({ value: s, label: td(`artStyles.${s}`, s) }))}
          />
          <HuePicker label={t('generator.color')} value={world.hue} onChange={(v) => set('hue', v)} />
        </div>
      </div>
      <div className="card stack">
        <div className="form-grid two">
          <TextField label={t('generator.name')} value={world.name} onChange={(v) => set('name', v)} max={LIMITS.worldName} required />
          <SelectField
            label={t('generator.genre')}
            value={world.genre}
            onChange={(v) => set('genre', v)}
            options={GENRES.map((g) => ({ value: g, label: td(`genres.${g}`, g) }))}
          />
        </div>
        <TextField label={t('generator.tagline')} value={world.tagline} onChange={(v) => set('tagline', v)} max={LIMITS.worldShortText} />
        <TextArea label={t('generator.description')} value={world.description} onChange={(v) => set('description', v)} max={LIMITS.worldLongText} rows={4} />
        <TextArea label={t('generator.lore')} value={world.lore} onChange={(v) => set('lore', v)} max={LIMITS.worldLongText} rows={3} />
        <TextField label={t('generator.atmosphere')} value={world.atmosphere} onChange={(v) => set('atmosphere', v)} max={LIMITS.worldShortText} />
        <ListEditor
          label={t('generator.rules')}
          values={world.rules}
          onChange={(v) => set('rules', v)}
          placeholder={t('generator.rulePlaceholder')}
          max={LIMITS.worldRules}
          maxLength={LIMITS.worldRule}
        />
      </div>
    </div>
  );
}

function worldValid(w: WorldInput): boolean {
  return (
    w.name.trim().length > 0 &&
    w.name.length <= LIMITS.worldName &&
    w.tagline.length <= LIMITS.worldShortText &&
    w.description.length <= LIMITS.worldLongText &&
    w.lore.length <= LIMITS.worldLongText &&
    w.atmosphere.length <= LIMITS.worldShortText
  );
}

export function WorldCreatePage() {
  const { t, td } = useI18n();
  const navigate = useNavigate();
  const { data: ai } = useAiStatus();
  const { generate, create } = useWorldGenerator();
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const [genre, setGenre] = useState<Genre>('fantasy');
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(3);
  const [useAi, setUseAi] = useState(true);
  const [draft, setDraft] = useState<WorldDraft | null>(null);
  const aiAvailable = ai?.mode === 'ai';

  const runGenerate = () =>
    generate.mutate(
      { genre, prompt, characterCount: count, useAi: aiAvailable && useAi },
      { onSuccess: (d) => setDraft(d), onError: showError },
    );

  const { characters = [], source, notice, ...world } = draft ?? ({} as WorldDraft);
  const setWorld = (w: WorldInput) => setDraft((d) => (d ? { ...d, ...w } : d));
  const setCharacters = (list: DraftCharacter[]) => setDraft((d) => (d ? { ...d, characters: list } : d));

  return (
    <div className="page">
      <Link to="/worlds" className="back-link">
        <ArrowLeft aria-hidden /> {t('nav.worlds')}
      </Link>
      <header className="page-header">
        <div className="titles">
          <h1>{t('generator.title')}</h1>
          <p>{t('generator.subtitle')}</p>
        </div>
      </header>

      <section className="card stack generator-card">
        <div className="field">
          <span className="field-label">{t('generator.genre')}</span>
          <div className="genre-grid" role="radiogroup" aria-label={t('generator.genre')}>
            {GENRES.map((g) => (
              <button key={g} type="button" role="radio" aria-checked={genre === g} className={`genre-option ${genre === g ? 'selected' : ''}`} onClick={() => setGenre(g)}>
                {td(`genres.${g}`, g)}
              </button>
            ))}
          </div>
        </div>
        <TextArea label={t('generator.prompt')} value={prompt} onChange={setPrompt} max={500} rows={2} placeholder={t('generator.promptPlaceholder')} />
        <div className="form-grid two">
          <div className="field">
            <label className="field-label" htmlFor="gen-count">
              {t('generator.characterCount')}: {count}
            </label>
            <input id="gen-count" type="range" min={0} max={4} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </div>
          {aiAvailable ? (
            <Toggle label={t('generator.useAi')} hint={t('generator.useAiHint')} checked={useAi} onChange={setUseAi} />
          ) : (
            <p className="notice small">
              <Sparkles aria-hidden />
              <span>{t('generator.aiUnavailable')}</span>
            </p>
          )}
        </div>
        <div className="row wrap">
          <button type="button" className="btn btn-primary" onClick={runGenerate} disabled={generate.isPending}>
            {generate.isPending ? <span className="spinner" aria-hidden /> : draft ? <Dices aria-hidden /> : <Wand2 aria-hidden />}
            {generate.isPending ? t('generator.generating') : draft ? t('generator.regenerate') : t('generator.generate')}
          </button>
        </div>
      </section>

      {draft && (
        <section className="stack draft-section" aria-label={t('generator.draft')}>
          <div className="row wrap">
            <h2>{t('generator.draft')}</h2>
            <span className={`badge ${source === 'ai' ? 'badge-ai' : 'badge-demo'}`}>{source === 'ai' ? t('generator.sourceAi') : t('generator.sourceDemo')}</span>
          </div>
          {notice && <div className="notice notice-warning">{t('generator.aiFailed', { reason: td(`aiErrors.${notice}`, notice) })}</div>}
          <WorldFields world={world as WorldInput} onChange={setWorld} />
          <section className="card stack">
            <h3>{t('generator.characters')}</h3>
            {characters.length === 0 && <p className="muted small">{t('generator.noCharacters')}</p>}
            <ul className="draft-characters">
              {characters.map((c, i) => (
                <li key={i} className="draft-character">
                  <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} size="md" decorative />
                  <div className="form-grid two grow">
                    <input
                      className="input"
                      value={c.name}
                      maxLength={LIMITS.characterName}
                      aria-label={`${t('characterForm.name')} ${i + 1}`}
                      onChange={(e) => setCharacters(characters.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <input
                      className="input"
                      value={c.role}
                      maxLength={LIMITS.characterShortText}
                      aria-label={`${t('characterForm.role')} ${i + 1}`}
                      onChange={(e) => setCharacters(characters.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
                    />
                    <p className="xsmall muted span-2">
                      {c.tagline} · {c.personality.join(', ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${t('common.remove')}: ${c.name}`}
                    onClick={() => setCharacters(characters.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={!worldValid(world as WorldInput) || characters.some((c) => !c.name.trim()) || create.isPending}
              onClick={() =>
                create.mutate(
                  { world: world as WorldInput, characters },
                  {
                    onSuccess: (r) => {
                      push('success', t('generator.created', { name: r.world.name }));
                      feedback(r.progress);
                      navigate(`/worlds/${r.world.id}`);
                    },
                    onError: showError,
                  },
                )
              }
            >
              {create.isPending ? <span className="spinner" aria-hidden /> : <Sparkles aria-hidden />}
              {create.isPending ? t('generator.creating') : t('generator.create')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export function WorldEditPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const query = useWorld(id);
  const { update } = useWorldActions(id);
  const showError = useErrorToast();
  const { push } = useToast();
  const [world, setWorld] = useState<WorldInput | null>(null);

  useEffect(() => {
    if (query.data && !world) {
      const w = query.data.world;
      setWorld({
        name: w.name,
        tagline: w.tagline,
        genre: w.genre,
        description: w.description,
        lore: w.lore,
        atmosphere: w.atmosphere,
        rules: w.rules,
        artStyle: w.artStyle,
        hue: w.hue,
      });
    }
  }, [query.data, world]);

  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!world) return <Loading />;

  return (
    <div className="page">
      <Link to={`/worlds/${id}`} className="back-link">
        <ArrowLeft aria-hidden /> {query.data.world.name}
      </Link>
      <header className="page-header">
        <h1>{t('generator.editTitle')}</h1>
      </header>
      <WorldFields world={world} onChange={setWorld} />
      <div className="form-actions">
        <Link to={`/worlds/${id}`} className="btn btn-ghost">
          {t('common.cancel')}
        </Link>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!worldValid(world) || update.isPending}
          onClick={() =>
            update.mutate(world, {
              onSuccess: () => {
                push('success', t('worlds.saved'));
                navigate(`/worlds/${id}`);
              },
              onError: showError,
            })
          }
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
