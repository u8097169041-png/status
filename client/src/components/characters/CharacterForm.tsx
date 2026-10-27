import { Drama } from 'lucide-react';
import { useState } from 'react';
import { LIMITS, WRITING_STYLES } from '../../../../shared/constants';
import type { CharacterInput } from '../../../../shared/types';
import { useWorlds } from '../../api/hooks';
import { useI18n } from '../../i18n';
import { Avatar, hueGradient } from '../ui/Avatar';
import { GlyphPicker, HuePicker, ListEditor, SelectField, TagInput, TextArea, TextField, Toggle } from '../ui/Form';

export const EMPTY_CHARACTER: CharacterInput = {
  name: '',
  handle: '',
  tagline: '',
  description: '',
  role: '',
  worldId: null,
  personality: [],
  interests: [],
  background: '',
  writingStyle: 'casual',
  styleNotes: '',
  rules: [],
  avatarHue: 200,
  avatarGlyph: 'initials',
  isRealPersonSim: false,
};

export function CharacterForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: CharacterInput;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (input: CharacterInput) => void;
  onCancel: () => void;
}) {
  const { t, td } = useI18n();
  const { data: worlds } = useWorlds();
  const [c, setC] = useState<CharacterInput>(initial);
  const set = <K extends keyof CharacterInput>(key: K, value: CharacterInput[K]) => setC((prev) => ({ ...prev, [key]: value }));
  const handleInvalid = c.handle !== '' && !/^[a-z0-9_]{2,30}$/i.test(c.handle);
  const valid = c.name.trim().length > 0 && !handleInvalid;

  return (
    <form
      className="character-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(c);
      }}
    >
      <div className="form-main stack">
        <section className="card stack">
          <h2 className="form-section-title">{t('characterForm.basics')}</h2>
          <div className="form-grid two">
            <TextField label={t('characterForm.name')} value={c.name} onChange={(v) => set('name', v)} max={LIMITS.characterName} required />
            <div className="field">
              <TextField
                label={t('characterForm.handle')}
                value={c.handle}
                onChange={(v) => set('handle', v.replace(/^@/, ''))}
                max={LIMITS.characterHandle}
                hint={t('characterForm.handleHint')}
              />
              {handleInvalid && <span className="field-error">{t('characterForm.handleHint')}</span>}
            </div>
          </div>
          <TextField label={t('characterForm.tagline')} value={c.tagline} onChange={(v) => set('tagline', v)} max={LIMITS.characterShortText} />
          <div className="form-grid two">
            <TextField label={t('characterForm.role')} value={c.role} onChange={(v) => set('role', v)} max={LIMITS.characterShortText} />
            <SelectField
              label={t('characterForm.world')}
              value={c.worldId ?? ''}
              onChange={(v) => set('worldId', v || null)}
              options={[{ value: '', label: t('characters.noWorld') }, ...(worlds ?? []).map((w) => ({ value: w.id, label: w.name }))]}
            />
          </div>
          <TextArea label={t('characterForm.description')} value={c.description} onChange={(v) => set('description', v)} max={LIMITS.characterLongText} rows={3} />
        </section>

        <section className="card stack">
          <h2 className="form-section-title">{t('characterForm.personality')}</h2>
          <TagInput
            label={t('characterForm.traits')}
            values={c.personality}
            onChange={(v) => set('personality', v)}
            placeholder={t('characterForm.traitsPlaceholder')}
            max={LIMITS.characterListItems}
            maxLength={LIMITS.characterListItem}
          />
          <TagInput
            label={t('characterForm.interests')}
            values={c.interests}
            onChange={(v) => set('interests', v)}
            placeholder={t('characterForm.interestsPlaceholder')}
            max={LIMITS.characterListItems}
            maxLength={LIMITS.characterListItem}
          />
          <TextArea label={t('characterForm.background')} value={c.background} onChange={(v) => set('background', v)} max={LIMITS.characterLongText} rows={4} />
        </section>

        <section className="card stack">
          <h2 className="form-section-title">{t('characterForm.voice')}</h2>
          <SelectField
            label={t('characterForm.writingStyle')}
            value={c.writingStyle}
            onChange={(v) => set('writingStyle', v)}
            options={WRITING_STYLES.map((s) => ({ value: s, label: td(`styles.${s}`, s) }))}
          />
          <TextField
            label={t('characterForm.styleNotes')}
            value={c.styleNotes}
            onChange={(v) => set('styleNotes', v)}
            max={LIMITS.characterShortText * 2}
            placeholder={t('characterForm.styleNotesPlaceholder')}
          />
          <ListEditor
            label={t('characterForm.rules')}
            values={c.rules}
            onChange={(v) => set('rules', v)}
            placeholder={t('characterForm.rulePlaceholder')}
            max={LIMITS.characterRules}
            maxLength={LIMITS.characterRule}
          />
        </section>

        <section className="card stack">
          <h2 className="form-section-title">{t('characterForm.labeling')}</h2>
          <Toggle
            label={t('characterForm.realPerson')}
            hint={t('characterForm.realPersonHint')}
            checked={c.isRealPersonSim}
            onChange={(v) => set('isRealPersonSim', v)}
          />
        </section>
      </div>

      <aside className="form-aside stack">
        <section className="card stack">
          <h2 className="form-section-title">{t('characterForm.appearance')}</h2>
          <div className="character-preview">
            <div className="character-preview-banner" style={{ background: hueGradient(c.avatarHue) }} />
            <Avatar name={c.name || '?'} hue={c.avatarHue} glyph={c.avatarGlyph} size="xl" ring="muted" decorative />
            <strong>{c.name || t('characterForm.name')}</strong>
            <span className="faint xsmall">@{c.handle || '…'}</span>
            {c.isRealPersonSim && (
              <span className="badge badge-sim">
                <Drama aria-hidden />
                {t('labels.fictionalSim')}
              </span>
            )}
            {c.tagline && <p className="small muted center-text">{c.tagline}</p>}
          </div>
          <HuePicker label={t('characterForm.avatarColor')} value={c.avatarHue} onChange={(v) => set('avatarHue', v)} />
          <GlyphPicker label={t('characterForm.avatarGlyph')} value={c.avatarGlyph} onChange={(v) => set('avatarGlyph', v)} hue={c.avatarHue} name={c.name} />
        </section>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid || busy}>
            {busy && <span className="spinner" aria-hidden />}
            {submitLabel}
          </button>
        </div>
      </aside>
    </form>
  );
}
