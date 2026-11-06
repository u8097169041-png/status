/** Festes Aussehen einer Figur (für alle Bilder) mit gezeichnetem Porträt bzw. lokal erzeugtem Profilfoto. */
import { Camera, Palette, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  BUILDS,
  EYE_COLORS,
  FACIAL_HAIR,
  FEATURES,
  GENDERS,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  type Appearance,
  type Feature,
} from '../../../../shared/appearance';
import { ApiError } from '../../api/client';
import { useAppearanceActions, useCharacterAppearance, useImageStatus } from '../../api/lifeHooks';
import { useI18n } from '../../i18n';
import { useErrorToast } from '../progress/useProgressFeedback';
import { NumberField, SelectField, TextField } from '../ui/Form';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

function hashOf(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function AppearanceEditor({ value, onCancel, onSave, busy }: { value: Appearance; onCancel: () => void; onSave: (a: Appearance) => void; busy: boolean }) {
  const { t, td } = useI18n();
  const [a, setA] = useState<Appearance>(value);
  const opt = <T extends string>(group: string, items: readonly T[]) => items.map((v) => ({ value: v, label: td(`appearanceValues.${group}.${v}`, v) }));
  const set = <K extends keyof Appearance>(k: K, v: Appearance[K]) => setA((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      title={t('appearance.edit')}
      onClose={onCancel}
      wide
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onSave(a)}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <p className="small muted">{t('appearance.hint')}</p>
      {a.kind === 'human' && (
        <div className="form-grid">
          <SelectField label={t('appearance.gender')} value={a.gender} onChange={(v) => set('gender', v)} options={opt('gender', GENDERS)} />
          <NumberField label={t('appearance.age')} value={a.age} min={18} max={95} onChange={(v) => set('age', v)} />
          <SelectField label={t('appearance.skin')} value={a.skin} onChange={(v) => set('skin', v)} options={opt('skin', SKIN_TONES)} />
          <SelectField label={t('appearance.hair')} value={a.hair} onChange={(v) => set('hair', v)} options={opt('hair', HAIR_STYLES)} />
          <SelectField label={t('appearance.hairColor')} value={a.hairColor} onChange={(v) => set('hairColor', v)} options={opt('hairColor', HAIR_COLORS)} />
          <SelectField label={t('appearance.eyes')} value={a.eyes} onChange={(v) => set('eyes', v)} options={opt('eyes', EYE_COLORS)} />
          <SelectField label={t('appearance.build')} value={a.build} onChange={(v) => set('build', v)} options={opt('build', BUILDS)} />
          <SelectField label={t('appearance.facialHair')} value={a.facialHair} onChange={(v) => set('facialHair', v)} options={opt('facialHair', FACIAL_HAIR)} />
        </div>
      )}
      <div className="stack-xs">
        <span className="field-label">{t('appearance.features')}</span>
        <div className="chip-row">
          {FEATURES.map((f: Feature) => {
            const on = a.features.includes(f);
            return (
              <button key={f} type="button" className={`chip ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => set('features', on ? a.features.filter((x) => x !== f) : [...a.features, f])}>
                {td(`appearanceValues.features.${f}`, f)}
              </button>
            );
          })}
        </div>
      </div>
      <TextField label={t('appearance.clothing')} value={a.clothing} max={120} onChange={(v) => set('clothing', v)} />
    </Modal>
  );
}

export function AppearanceCard({ characterId, name }: { characterId: string; name: string }) {
  const { t } = useI18n();
  const query = useCharacterAppearance(characterId);
  const status = useImageStatus();
  const actions = useAppearanceActions(characterId);
  const showError = useErrorToast();
  const { push } = useToast();
  const [editing, setEditing] = useState(false);
  const data = query.data;
  if (!data) return null;
  const ready = Boolean(status.data?.backend && status.data.model);
  const pending = Boolean(data.pendingJob) || actions.generate.isPending;
  // Gezeichnetes Porträt: Der Parameter ändert sich mit dem Aussehen, damit der Browser nach dem Speichern neu lädt.
  const src = data.photoUrl ?? `/api/media/avatars/${encodeURIComponent(characterId)}?a=${hashOf(JSON.stringify(data.appearance))}`;
  const generate = () =>
    actions.generate.mutate(undefined, {
      onSuccess: () => push('info', t('appearance.requested')),
      onError: (e) => (e instanceof ApiError && e.code === 'images_unavailable' ? push('info', t('appearance.unavailable')) : showError(e)),
    });
  return (
    <section className="card appearance-card" aria-labelledby={`appearance-${characterId}`}>
      <img className="appearance-portrait" src={src} alt={`${name} – ${data.photoUrl ? t('appearance.photo') : t('appearance.drawn')}`} loading="lazy" />
      <div className="stack-sm grow min-w-0">
        <h2 id={`appearance-${characterId}`} className="card-heading">
          {t('appearance.title')}
        </h2>
        <p className="xsmall muted">{t('appearance.hint')}</p>
        <span className="badge">{data.photoUrl ? t('appearance.photo') : t('appearance.drawn')}</span>
        <div className="row wrap">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            <Palette aria-hidden /> {t('appearance.edit')}
          </button>
          {ready && (
            <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={generate}>
              {pending ? <span className="spinner" aria-hidden /> : data.photoUrl ? <RefreshCw aria-hidden /> : <Camera aria-hidden />}{' '}
              {data.photoUrl ? t('appearance.regenerate') : t('appearance.generate')}
            </button>
          )}
          {data.photoUrl && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.removePhoto.mutate(undefined, { onError: showError })}>
              <Trash2 aria-hidden /> {t('appearance.removePhoto')}
            </button>
          )}
        </div>
        {!ready && status.data && <p className="xsmall faint">{t('appearance.unavailable')}</p>}
      </div>
      {editing && (
        <AppearanceEditor
          value={data.appearance}
          busy={actions.save.isPending}
          onCancel={() => setEditing(false)}
          onSave={(a) =>
            actions.save.mutate(a, {
              onSuccess: () => {
                setEditing(false);
                push('success', t('appearance.saved'));
              },
              onError: showError,
            })
          }
        />
      )}
    </section>
  );
}
