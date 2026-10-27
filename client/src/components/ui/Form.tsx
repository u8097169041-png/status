import { Plus, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { AVATAR_GLYPHS, type AvatarGlyph } from '../../../../shared/constants';
import { useI18n } from '../../i18n';
import { Avatar } from './Avatar';

export function Field({
  label,
  hint,
  error,
  children,
  id,
  counter,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  id: string;
  counter?: { value: number; max: number };
}) {
  return (
    <div className="field">
      <div className="row-between">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {counter && (
          <span className={`char-count ${counter.value > counter.max ? 'over' : ''}`}>
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  max,
  hint,
  placeholder,
  required,
  type = 'text',
  autoComplete = 'off',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'password' | 'number';
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id} counter={max && value.length > max * 0.7 ? { value: value.length, max } : undefined}>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        spellCheck={type === 'text'}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  max,
  hint,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  hint?: string;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id} counter={max ? { value: value.length, max } : undefined}>
      <textarea id={id} className="textarea" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id}>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="toggle">
      <div className="toggle-text">
        <strong id={id}>{label}</strong>
        {hint && <span>{hint}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        className="switch"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  hint?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field label={label} hint={hint} id={id}>
      <input
        id={id}
        className="input"
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft === null) return;
          const n = Number(draft.replace(',', '.'));
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, step >= 1 ? Math.round(n) : n)));
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </Field>
  );
}

/** Liste kurzer Einträge (Tags) mit Eingabe per Enter. */
export function TagInput({
  label,
  values,
  onChange,
  placeholder,
  max = 12,
  maxLength = 60,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  hint?: string;
}) {
  const id = useId();
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim().slice(0, maxLength);
    if (!v || values.includes(v) || values.length >= max) return;
    onChange([...values, v]);
    setDraft('');
  };
  return (
    <Field label={label} hint={hint} id={id}>
      {values.length > 0 && (
        <div className="tag-list">
          {values.map((v) => (
            <span key={v} className="tag">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`${t('common.remove')}: ${v}`}>
                <X />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="row">
        <input
          id={id}
          className="input"
          value={draft}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={values.length >= max}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn-secondary" onClick={add} disabled={!draft.trim() || values.length >= max}>
          <Plus /> <span className="sr-only">{t('common.add')}</span>
        </button>
      </div>
    </Field>
  );
}

/** Liste längerer Einträge (z. B. Regeln). */
export function ListEditor({
  label,
  values,
  onChange,
  placeholder,
  max = 10,
  maxLength = 200,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
}) {
  const id = useId();
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim().slice(0, maxLength);
    if (!v || values.length >= max) return;
    onChange([...values, v]);
    setDraft('');
  };
  return (
    <Field label={label} id={id}>
      {values.length > 0 && (
        <ul className="list-editor">
          {values.map((v, i) => (
            <li key={`${i}-${v}`}>
              <input
                className="input"
                value={v}
                maxLength={maxLength}
                aria-label={`${label} ${i + 1}`}
                onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <button type="button" className="icon-btn" onClick={() => onChange(values.filter((_, j) => j !== i))} aria-label={t('common.remove')}>
                <X />
              </button>
            </li>
          ))}
        </ul>
      )}
      {values.length < max && (
        <div className="row">
          <input
            id={id}
            className="input"
            value={draft}
            placeholder={placeholder}
            maxLength={maxLength}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" className="btn btn-secondary" onClick={add} disabled={!draft.trim()}>
            <Plus /> <span className="sr-only">{t('common.add')}</span>
          </button>
        </div>
      )}
    </Field>
  );
}

export function HuePicker({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <Field label={label} id={id}>
      <input
        id={id}
        type="range"
        min={0}
        max={359}
        value={value}
        className="hue-slider"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

export function GlyphPicker({
  label,
  value,
  onChange,
  hue,
  name,
}: {
  label: string;
  value: AvatarGlyph;
  onChange: (v: AvatarGlyph) => void;
  hue: number;
  name: string;
}) {
  const { td } = useI18n();
  const groupId = useId();
  return (
    <div className="field" role="radiogroup" aria-labelledby={groupId}>
      <span className="field-label" id={groupId}>
        {label}
      </span>
      <div className="glyph-grid">
        {AVATAR_GLYPHS.map((glyph) => (
          <button
            key={glyph}
            type="button"
            role="radio"
            aria-checked={value === glyph}
            className={`glyph-option ${value === glyph ? 'selected' : ''}`}
            onClick={() => onChange(glyph)}
            title={td(`glyphs.${glyph}`)}
          >
            <Avatar name={name || '?'} hue={hue} glyph={glyph} size="sm" decorative />
            <span className="sr-only">{td(`glyphs.${glyph}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={value === tab.id}
          aria-controls={`panel-${tab.id}`}
          className="tab"
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => {
            const index = tabs.findIndex((x) => x.id === tab.id);
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
              onChange(next.id);
              document.getElementById(`tab-${next.id}`)?.focus();
            }
          }}
        >
          {tab.label}
          {tab.count !== undefined && <span className="count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
