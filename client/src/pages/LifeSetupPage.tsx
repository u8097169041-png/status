import { ArrowLeft, Bot, Plus, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CHARACTER_STANCES, LIFE_ARCHETYPES, LIFE_GENRES, type LifeSetupCharacter, type LifeSetupDraft } from '../../../shared/life';
import { useCharacters } from '../api/hooks';
import { useLifeSetup, useLifeSetupJob, type LifeSetupInput } from '../api/lifeHooks';
import { useErrorToast } from '../components/progress/useProgressFeedback';
import { Avatar } from '../components/ui/Avatar';
import { SelectField, Tabs, TextArea, TextField, Toggle } from '../components/ui/Form';
import { useI18n, type TKey } from '../i18n';

type Mode = 'prompt' | 'steps';
const PARTS = ['background', 'characters', 'relationships', 'start', 'details'] as const;
type Part = (typeof PARTS)[number];
const PART_LABEL: Record<Part, [TKey, TKey]> = {
  background: ['life.partBackground', 'life.partBackgroundHint'],
  characters: ['life.partCharacters', 'life.partCharactersHint'],
  relationships: ['life.partRelationships', 'life.partRelationshipsHint'],
  start: ['life.partStart', 'life.partStartHint'],
  details: ['life.partDetails', 'life.partDetailsHint'],
};
const EXAMPLES: [TKey, TKey][] = [
  ['life.exampleBoss', 'life.exampleBossText'],
  ['life.examplePolitician', 'life.examplePoliticianText'],
  ['life.exampleFounder', 'life.exampleFounderText'],
  ['life.exampleOrdinary', 'life.exampleOrdinaryText'],
];

function SocialPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useI18n();
  const characters = useCharacters({ npc: true });
  const [open, setOpen] = useState(false);
  const list = (characters.data ?? []).filter((c) => !c.isPlayer);
  const chosen = list.filter((c) => selected.includes(c.id));
  return (
    <div className="stack-sm">
      <div className="row-between">
        <span className="field-label">{t('life.importSocial')}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? <X aria-hidden /> : <Plus aria-hidden />} {open ? t('common.close') : t('common.add')}
        </button>
      </div>
      <p className="xsmall muted">{t('life.importHint')}</p>
      {chosen.length > 0 && (
        <div className="chip-row">
          {chosen.map((c) => (
            <button key={c.id} type="button" className="chip active" onClick={() => onChange(selected.filter((x) => x !== c.id))} aria-label={`${t('common.remove')}: ${c.name}`}>
              <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} photoUrl={c.photoUrl} size="xs" decorative /> {c.name} <X aria-hidden className="icon-xs" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <ul className="pick-list life-pick-list">
          {list.map((c) => {
            const on = selected.includes(c.id);
            return (
              <li key={c.id}>
                <label className="pick-row">
                  <input type="checkbox" checked={on} disabled={!on && selected.length >= 6} onChange={() => onChange(on ? selected.filter((x) => x !== c.id) : [...selected, c.id])} />
                  <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} photoUrl={c.photoUrl} size="sm" decorative />
                  <span className="grow min-w-0">
                    <strong className="small block truncate">{c.name}</strong>
                    <span className="xsmall muted block truncate">
                      {c.role}
                      {c.worldName ? ` · ${c.worldName}` : ''}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CharacterEditor({ c, onChange, onRemove }: { c: LifeSetupCharacter; onChange: (c: LifeSetupCharacter) => void; onRemove: () => void }) {
  const { t, td } = useI18n();
  return (
    <li className="card card-tight stack-sm life-draft-character">
      <div className="row-between">
        <strong className="small">{c.name || t('life.newCharacter')}</strong>
        <button type="button" className="icon-btn small-icon" onClick={onRemove} aria-label={`${t('common.remove')}: ${c.name}`}>
          <Trash2 />
        </button>
      </div>
      <div className="form-grid">
        <TextField label={t('life.name')} value={c.name} max={50} onChange={(name) => onChange({ ...c, name })} />
        <TextField label={t('life.role')} value={c.role} max={80} onChange={(role) => onChange({ ...c, role })} />
        <SelectField
          label={t('life.stance')}
          value={c.stance}
          onChange={(stance) => onChange({ ...c, stance })}
          options={CHARACTER_STANCES.map((s) => ({ value: s, label: td(`lifeStances.${s}`, s) }))}
        />
      </div>
      <TextArea label={t('life.description')} value={c.description} max={400} rows={2} onChange={(description) => onChange({ ...c, description })} />
    </li>
  );
}

function DraftEditor({ draft, onChange, onStart, busy, onBack }: { draft: LifeSetupDraft; onChange: (d: LifeSetupDraft) => void; onStart: () => void; busy: boolean; onBack: () => void }) {
  const { t, td } = useI18n();
  const idPrefix = useId();
  const set = <K extends keyof LifeSetupDraft>(key: K, value: LifeSetupDraft[K]) => onChange({ ...draft, [key]: value });
  return (
    <div className="stack">
      <div className={`notice ${draft.source === 'ai' ? 'notice-success' : ''}`} role="note">
        {draft.source === 'ai' ? <Bot aria-hidden /> : <Wand2 aria-hidden />}
        <span>
          {draft.source === 'ai' ? t('life.draftAi') : t('life.draftRules')}
          {draft.notice && ` ${t('life.draftNotice', { reason: td(`aiErrors.${draft.notice}`, draft.notice) })}`}
        </span>
      </div>
      <section className="card stack-sm">
        <div className="form-grid">
          <TextField label={t('life.storyTitle')} value={draft.title} max={80} onChange={(v) => set('title', v)} />
          <TextField label={t('life.playerName')} value={draft.playerName} max={60} onChange={(v) => set('playerName', v)} />
          <TextField label={t('life.role')} value={draft.playerRole} max={80} onChange={(v) => set('playerRole', v)} />
          <SelectField label={t('life.archetype')} value={draft.archetype} onChange={(v) => set('archetype', v)} options={LIFE_ARCHETYPES.map((a) => ({ value: a, label: td(`lifeArchetypes.${a}`, a) }))} />
        </div>
        <div className="stack-xs">
          <span className="field-label">{t('life.genres')}</span>
          <div className="chip-row">
            {LIFE_GENRES.map((g) => {
              const on = draft.genres.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  className={`chip ${on ? 'active' : ''}`}
                  aria-pressed={on}
                  disabled={!on && draft.genres.length >= 3}
                  onClick={() => set('genres', on ? (draft.genres.length > 1 ? draft.genres.filter((x) => x !== g) : draft.genres) : [...draft.genres, g])}
                >
                  {td(`lifeGenres.${g}`, g)}
                </button>
              );
            })}
          </div>
        </div>
        <TextArea label={t('life.setting')} value={draft.setting} max={600} rows={2} onChange={(v) => set('setting', v)} />
        <div className="form-grid">
          <TextField label={t('life.location')} value={draft.location} max={80} onChange={(v) => set('location', v)} />
        </div>
        <TextArea label={t('life.opening')} value={draft.opening} max={800} rows={2} onChange={(v) => set('opening', v)} />
      </section>
      <section className="card stack-sm" aria-labelledby={`${idPrefix}-stats`}>
        <h2 id={`${idPrefix}-stats`} className="card-heading">
          {t('life.startValues')}
        </h2>
        <p className="xsmall muted">{t('life.startValuesHint')}</p>
        <div className="life-stat-editor">
          {draft.statKeys.map((k) => (
            <label key={k} className="meter">
              <span>{td(`lifeStats.${k}`, k)}</span>
              <input type="range" min={0} max={100} value={draft.stats[k] ?? 0} onChange={(e) => set('stats', { ...draft.stats, [k]: Number(e.target.value) })} />
              <strong>{draft.stats[k] ?? 0}</strong>
            </label>
          ))}
        </div>
      </section>
      <section className="stack-sm" aria-labelledby={`${idPrefix}-cast`}>
        <div className="row-between">
          <h2 id={`${idPrefix}-cast`} className="card-heading">
            {t('life.castTitle')}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={draft.characters.length >= 10}
            onClick={() =>
              set('characters', [
                ...draft.characters,
                { name: '', role: '', description: '', personality: [], goals: [], secrets: [], stance: 'neutral', affinity: 0, trust: 35, loyalty: 20, fear: 0 },
              ])
            }
          >
            <Plus aria-hidden /> {t('life.addCharacter')}
          </button>
        </div>
        <ul className="stack-sm">
          {draft.characters.map((c, i) => (
            <CharacterEditor
              key={i}
              c={c}
              onChange={(next) => set('characters', draft.characters.map((x, j) => (j === i ? next : x)))}
              onRemove={() => set('characters', draft.characters.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      </section>
      <div className="row-between">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft aria-hidden /> {t('common.back')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !draft.title.trim() || !draft.playerName.trim() || !draft.characters.some((c) => c.name.trim())}
          onClick={onStart}
        >
          {busy ? <span className="spinner" aria-hidden /> : <Sparkles aria-hidden />} {t('life.startStory')}
        </button>
      </div>
    </div>
  );
}

export function LifeSetupPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const setup = useLifeSetup();
  const showError = useErrorToast();
  const [mode, setMode] = useState<Mode>('prompt');
  const [prompt, setPrompt] = useState('');
  const [parts, setParts] = useState<Record<Part, string>>({ background: '', characters: '', relationships: '', start: '', details: '' });
  const [playerName, setPlayerName] = useState('');
  const [social, setSocial] = useState<string[]>([]);
  const [useAi, setUseAi] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LifeSetupDraft | null>(null);
  const job = useLifeSetupJob(draft ? null : jobId);

  useEffect(() => {
    if (job.data?.status === 'done' && job.data.draft && !draft) {
      setDraft(job.data.draft);
      setJobId(null);
    }
  }, [job.data, draft]);

  const filled = mode === 'prompt' ? prompt.trim().length >= 20 : Object.values(parts).join(' ').trim().length >= 20;
  const running = Boolean(jobId) && !draft;

  const createDraft = () => {
    const input: LifeSetupInput = {
      prompt: mode === 'prompt' ? prompt : '',
      ...(mode === 'steps' ? { parts: Object.fromEntries(PARTS.filter((p) => parts[p].trim()).map((p) => [p, parts[p]])) } : {}),
      ...(playerName.trim() ? { playerName: playerName.trim() } : {}),
      socialCharacterIds: social,
      useAi,
    };
    setup.start.mutate(input, {
      onSuccess: (j) => {
        if (j.status === 'done' && j.draft) setDraft(j.draft);
        else setJobId(j.id);
      },
      onError: showError,
    });
  };

  return (
    <div className="page page-narrow">
      <header className="page-header">
        <div className="titles">
          <Link to="/life" className="xsmall muted row">
            <ArrowLeft aria-hidden className="icon-xs" /> {t('life.back')}
          </Link>
          <h1>{draft ? t('life.draftTitle') : t('life.setupTitle')}</h1>
          {!draft && <p>{t('life.setupIntro')}</p>}
        </div>
      </header>

      {draft ? (
        <DraftEditor
          draft={draft}
          onChange={setDraft}
          busy={setup.create.isPending}
          onBack={() => setDraft(null)}
          onStart={() =>
            setup.create.mutate(
              { ...draft, characters: draft.characters.filter((c) => c.name.trim()) },
              { onSuccess: (story) => navigate(`/life/${story.id}`), onError: showError },
            )
          }
        />
      ) : (
        <div className="stack">
          <Tabs<Mode>
            label={t('life.setupTitle')}
            value={mode}
            onChange={setMode}
            tabs={[
              { id: 'prompt', label: t('life.oneprompt') },
              { id: 'steps', label: t('life.steps') },
            ]}
          />
          <section className="card stack-sm" role="tabpanel" id={`panel-${mode}`} aria-labelledby={`tab-${mode}`}>
            {mode === 'prompt' ? (
              <>
                <div className="stack-xs">
                  <span className="field-label">{t('life.examples')}</span>
                  <div className="chip-row">
                    {EXAMPLES.map(([label, text]) => (
                      <button key={label} type="button" className="chip" onClick={() => setPrompt(t(text))}>
                        {t(label)}
                      </button>
                    ))}
                  </div>
                </div>
                <TextArea label={t('life.promptLabel')} value={prompt} max={6000} rows={9} placeholder={t('life.promptPlaceholder')} onChange={setPrompt} />
              </>
            ) : (
              PARTS.map((p) => (
                <TextArea
                  key={p}
                  label={t(PART_LABEL[p][0])}
                  hint={t(PART_LABEL[p][1])}
                  value={parts[p]}
                  max={p === 'background' || p === 'characters' ? 3000 : 2000}
                  rows={p === 'characters' ? 5 : 3}
                  onChange={(v) => setParts((x) => ({ ...x, [p]: v }))}
                />
              ))
            )}
          </section>
          <section className="card stack-sm">
            <TextField label={`${t('life.playerName')} (${t('common.optional')})`} value={playerName} max={60} onChange={setPlayerName} />
            <SocialPicker selected={social} onChange={setSocial} />
            <Toggle label={t('life.useAi')} hint={t('life.useAiHint')} checked={useAi} onChange={setUseAi} />
          </section>
          {running ? (
            <div className="notice" role="status">
              <span className="spinner" aria-hidden />
              <span className="grow">{t('life.drafting', { seconds: Math.round((job.data?.elapsedMs ?? 0) / 1000) })}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => jobId && setup.cancel.mutate(jobId, { onSuccess: (j) => j.draft && setDraft(j.draft), onError: showError })}>
                {t('life.cancelDraft')}
              </button>
            </div>
          ) : (
            <div className="row-end">
              <button type="button" className="btn btn-primary" disabled={!filled || setup.start.isPending} onClick={createDraft}>
                {setup.start.isPending ? <span className="spinner" aria-hidden /> : <Wand2 aria-hidden />} {t('life.createDraft')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
