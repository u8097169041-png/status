import { ArrowLeft, Dices, Info, Sparkles, Trash2, Wand2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ART_STYLES, GENRES, LIMITS, type Genre } from '../../../shared/constants';
import type { CharacterInput, GenerationJobDto, WorldDraft, WorldInput } from '../../../shared/types';
import { useAiStatus, useGenerationJob, useWorld, useWorldActions, useWorldCover, useWorldGenerator } from '../api/hooks';
import { ApiError } from '../api/client';
import { useErrorToast, useProgressFeedback } from '../components/progress/useProgressFeedback';
import { Avatar } from '../components/ui/Avatar';
import { HuePicker, ListEditor, SelectField, TextArea, TextField, Toggle } from '../components/ui/Form';
import { ErrorState, Loading } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { CoverPicker, type CoverState } from '../components/worlds/CoverPicker';
import { useI18n, type TKey } from '../i18n';

type DraftCharacter = Omit<CharacterInput, 'worldId'>;

function WorldFields({
  world,
  onChange,
  cover,
  onCoverChange,
}: {
  world: WorldInput;
  onChange: (w: WorldInput) => void;
  cover: CoverState;
  onCoverChange: (c: CoverState) => void;
}) {
  const { t, td } = useI18n();
  const set = <K extends keyof WorldInput>(key: K, value: WorldInput[K]) => onChange({ ...world, [key]: value });
  return (
    <div className="world-form">
      <div className="world-form-preview card">
        <CoverPicker cover={cover} onChange={onCoverChange} seed={world.name || 'preview'} artStyle={world.artStyle} hue={world.hue} />
        <span className="field-hint">{t('cover.fallbackHint')}</span>
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

/** Fortschritt einer laufenden KI-Generierung mit Abbruchmöglichkeit. */
function GenerationProgress({ job, onCancel, cancelling }: { job: GenerationJobDto | undefined; onCancel: () => void; cancelling: boolean }) {
  const { t } = useI18n();
  const seconds = Math.round((job?.elapsedMs ?? 0) / 1000);
  const pct = job ? Math.min(95, Math.round((job.tokens / Math.max(1, job.expectedTokens)) * 100)) : 0;
  return (
    <div className="generation-progress card stack-sm" role="status" aria-live="polite">
      <div className="row-between wrap">
        <strong className="row">
          <span className="spinner" aria-hidden />
          {t('generator.progressTitle', { provider: t(`aiProviders.${job?.provider ?? 'local'}` as TKey) })}
        </strong>
        <span className="xsmall muted">
          {job?.model ? `${job.model} · ` : ''}
          {t('generator.progressElapsed', { seconds })}
        </span>
      </div>
      <div className="progress" role="progressbar" aria-label={t('generator.generating')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="xsmall muted">
        {job && job.tokens > 0 ? t('generator.progressTokens', { tokens: job.tokens, expected: job.expectedTokens }) : t('generator.progressLoading')}
      </span>
      <p className="xsmall faint">{t('generator.progressHint')}</p>
      <button type="button" className="btn btn-secondary btn-sm align-start" onClick={onCancel} disabled={cancelling}>
        <XCircle aria-hidden /> {t('generator.cancel')}
      </button>
    </div>
  );
}

const STEPS_FOR: Record<string, TKey[]> = {
  'local-unreachable': ['generator.stepStartOllama', 'generator.stepCheck', 'generator.stepRecheck'],
  'local-no-model': ['generator.stepPull', 'generator.stepRecheck'],
  'local-model-missing': ['generator.stepPull', 'generator.stepChooseModel'],
  timeout: ['generator.stepSmallerModel', 'generator.stepFewerCharacters', 'generator.stepLongTimeout'],
  busy: ['generator.stepRetry'],
  truncated: ['generator.stepRetry', 'generator.stepFewerCharacters'],
  invalid_response: ['generator.stepRetry', 'generator.stepSmallerModel'],
};

/** Warum ein regelbasierter Entwurf verwendet wurde – mit konkreten Lösungsschritten. */
function GeneratorNotice({ notice }: { notice: string }) {
  const { t, td } = useI18n();
  if (notice === 'cancelled') {
    return (
      <p className="notice small">
        <Info aria-hidden />
        <span>{t('generator.cancelled')}</span>
      </p>
    );
  }
  const reason = notice.includes('-') ? td(`aiReasons.${notice}`, notice) : td(`aiErrors.${notice}`, notice);
  const steps = STEPS_FOR[notice] ?? [];
  return (
    <div className="notice notice-warning stack-sm generator-notice">
      <span>{t('generator.aiFailed', { reason })}</span>
      {steps.length > 0 && (
        <>
          <strong className="small">{t('generator.fixSteps')}</strong>
          <ol className="small">
            {steps.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ol>
        </>
      )}
      <Link to="/settings#ai" className="small">
        {t('generator.openDiagnosis')} →
      </Link>
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
  const { start, cancel, create } = useWorldGenerator();
  const covers = useWorldCover();
  const [cover, setCover] = useState<CoverState>({ kind: 'keep', url: null });
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const [genre, setGenre] = useState<Genre>('fantasy');
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(3);
  const [useAi, setUseAi] = useState(true);
  const [draft, setDraft] = useState<WorldDraft | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useGenerationJob(jobId);
  const aiAvailable = Boolean(ai && ai.active !== 'fallback');
  const generating = start.isPending || jobId !== null;

  // Fertiger Auftrag: KI-Entwurf oder regelbasierter Entwurf mit Begründung übernehmen.
  useEffect(() => {
    const j = job.data;
    if (j && j.status !== 'running' && j.draft) {
      setDraft(j.draft);
      setJobId(null);
    }
  }, [job.data]);

  const runGenerate = () =>
    start.mutate(
      // Auch ohne erkannte KI fragen: Der Server prüft erneut und nennt den Grund, falls sie fehlt.
      { genre, prompt, characterCount: count, useAi },
      {
        onSuccess: (j) => {
          if (j.status === 'running') setJobId(j.id);
          else if (j.draft) setDraft(j.draft);
        },
        onError: showError,
      },
    );

  const cancelJob = () => {
    if (!jobId) return;
    cancel.mutate(jobId, {
      onSuccess: (j) => {
        if (j.draft) setDraft(j.draft);
        setJobId(null);
      },
      onError: showError,
    });
  };

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
          <button type="button" className="btn btn-primary" onClick={runGenerate} disabled={generating}>
            {generating ? <span className="spinner" aria-hidden /> : draft ? <Dices aria-hidden /> : <Wand2 aria-hidden />}
            {generating ? t('generator.generating') : draft ? t('generator.regenerate') : t('generator.generate')}
          </button>
        </div>
        {jobId && <GenerationProgress job={job.data} onCancel={cancelJob} cancelling={cancel.isPending} />}
      </section>

      {draft && (
        <section className="stack draft-section" aria-label={t('generator.draft')}>
          <div className="row wrap">
            <h2>{t('generator.draft')}</h2>
            <span className={`badge ${source === 'ai' ? 'badge-ai' : 'badge-demo'}`}>{source === 'ai' ? t('generator.sourceAi') : t('generator.sourceDemo')}</span>
          </div>
          {notice && <GeneratorNotice notice={notice} />}
          <WorldFields world={world as WorldInput} onChange={setWorld} cover={cover} onCoverChange={setCover} />
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
              disabled={!worldValid(world as WorldInput) || characters.some((c) => !c.name.trim()) || create.isPending || covers.save.isPending}
              onClick={() =>
                create.mutate(
                  { world: world as WorldInput, characters },
                  {
                    onSuccess: async (r) => {
                      push('success', t('generator.created', { name: r.world.name }));
                      feedback(r.progress);
                      // Das Bild wird nach dem Anlegen gespeichert; scheitert es, bleibt die Welt erhalten.
                      if (cover.kind === 'new') {
                        try {
                          await covers.save.mutateAsync({ worldId: r.world.id, file: cover.blob });
                        } catch (e) {
                          push('error', t('cover.saveFailed'), e instanceof ApiError ? e.message : undefined);
                        }
                      }
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
  const covers = useWorldCover();
  const showError = useErrorToast();
  const { push } = useToast();
  const [world, setWorld] = useState<WorldInput | null>(null);
  const [cover, setCover] = useState<CoverState | null>(null);

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
      setCover({ kind: 'keep', url: w.coverUrl });
    }
  }, [query.data, world]);

  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!world || !cover) return <Loading />;

  const save = async () => {
    try {
      await update.mutateAsync(world);
      if (cover.kind === 'new') await covers.save.mutateAsync({ worldId: id, file: cover.blob });
      if (cover.kind === 'remove' && query.data.world.coverUrl) await covers.remove.mutateAsync(id);
      push('success', t('worlds.saved'));
      navigate(`/worlds/${id}`);
    } catch (e) {
      showError(e);
    }
  };
  const saving = update.isPending || covers.save.isPending || covers.remove.isPending;

  return (
    <div className="page">
      <Link to={`/worlds/${id}`} className="back-link">
        <ArrowLeft aria-hidden /> {query.data.world.name}
      </Link>
      <header className="page-header">
        <h1>{t('generator.editTitle')}</h1>
      </header>
      <WorldFields world={world} onChange={setWorld} cover={cover} onCoverChange={setCover} />
      <div className="form-actions">
        <Link to={`/worlds/${id}`} className="btn btn-ghost">
          {t('common.cancel')}
        </Link>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!worldValid(world) || saving}
          onClick={() => void save()}
        >
          {saving && <span className="spinner" aria-hidden />}
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
