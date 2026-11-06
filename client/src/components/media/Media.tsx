/**
 * Gemeinsame Bausteine für Bilder und Vorschläge in Social-Chats und Lebensgeschichten:
 * vier Vorschlagsknöpfe, Bilddialog, Fortschritt eines Bildauftrags und Darstellung eines Szenenbilds.
 */
import { Camera, Compass, ImageOff, Lightbulb, MapPin, Shuffle, Sparkles, X, Zap, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { SuggestionKind } from '../../../../shared/life';
import type { ImageJobDto } from '../../../../shared/types';
import { useCancelImageJob, useImageJob, useImageStatus } from '../../api/lifeHooks';
import { useI18n } from '../../i18n';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';

const KIND_ICON: Record<SuggestionKind, LucideIcon> = { smart: Lightbulb, alternative: Compass, risky: Zap, surprising: Shuffle };

export interface SuggestionItem {
  id: string;
  kind: SuggestionKind;
  text: string;
}

/** Vier Vorschläge: klug, alternativ, riskant, überraschend. Ein Klick übernimmt den Vorschlag als eigene Handlung. */
export function SuggestionButtons({ suggestions, onPick, disabled }: { suggestions: SuggestionItem[]; onPick: (s: SuggestionItem) => void; disabled?: boolean }) {
  const { t, td } = useI18n();
  if (!suggestions.length) return null;
  return (
    <div className="suggestion-grid" role="group" aria-label={t('life.suggestionsTitle')}>
      {suggestions.map((s) => {
        const Icon = KIND_ICON[s.kind] ?? Sparkles;
        return (
          <button key={s.id} type="button" className={`suggestion suggestion-${s.kind}`} disabled={disabled} onClick={() => onPick(s)}>
            <span className="suggestion-kind">
              <Icon aria-hidden /> {td(`lifeKinds.${s.kind}`, s.kind)}
            </span>
            <span className="suggestion-text">{s.text}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Dialog „Bild des Moments“ mit optionaler eigener Beschreibung und Hinweis zur Bild-KI. */
export function ImageDialog({ onClose, onSubmit, busy }: { onClose: () => void; onSubmit: (description: string) => void; busy?: boolean }) {
  const { t } = useI18n();
  const status = useImageStatus();
  const [description, setDescription] = useState('');
  const id = useId();
  const ready = status.data?.backend && status.data.model;
  return (
    <Modal
      title={t('images.dialogTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onSubmit(description.trim())} data-autofocus>
            {busy ? <span className="spinner" aria-hidden /> : <Camera aria-hidden />} {t('images.generate')}
          </button>
        </>
      }
    >
      <p className="small muted">{t('images.dialogIntro')}</p>
      <div className="field">
        <label className="field-label" htmlFor={id}>
          {t('images.descriptionLabel')}
        </label>
        <textarea id={id} className="textarea" rows={2} maxLength={300} value={description} placeholder={t('images.descriptionPlaceholder')} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {status.data && (
        <p className={`small ${ready ? 'muted' : 'notice-box'}`} role="note">
          {ready
            ? t('images.backendReady', { backend: status.data.backend === 'comfyui' ? 'ComfyUI' : 'Forge/A1111', model: status.data.model ?? '?' })
            : t('images.noBackend')}
        </p>
      )}
    </Modal>
  );
}

/** Fortschritt eines Bildauftrags; ruft `onDone` einmal auf, wenn er abgeschlossen ist. */
export function ImageJobIndicator({ jobId, onDone }: { jobId: string; onDone: (job: ImageJobDto) => void }) {
  const { t, td } = useI18n();
  const [finished, setFinished] = useState(false);
  const job = useImageJob(jobId);
  const cancel = useCancelImageJob();
  const data = job.data;
  useEffect(() => {
    if (!data || finished) return;
    if (data.status !== 'queued' && data.status !== 'running') {
      setFinished(true);
      onDone(data);
    }
  }, [data, finished, onDone]);
  if (!data || finished) return null;
  return (
    <div className="image-job" role="status">
      <span className="spinner" aria-hidden />
      <span className="grow small">
        {data.status === 'queued' ? t('images.queued', { position: data.position }) : t('images.running', { seconds: Math.round(data.elapsedMs / 1000) })}
      </span>
      <button type="button" className="icon-btn small-icon" aria-label={t('images.cancel')} onClick={() => cancel.mutate(jobId)}>
        <X />
      </button>
      {data.error && <span className="xsmall">{td(`aiErrors.${data.error}`, data.error)}</span>}
    </div>
  );
}

export interface ScenePerson {
  id: string;
  name: string;
  hue: number;
  photoUrl?: string | null;
}

/** Szenenbild (Foto) oder – ohne Bild-KI – eine gezeichnete Szenenkarte mit Figuren und Ort. */
export function SceneImage({
  imageUrl,
  sceneCard,
  caption,
  people,
}: {
  imageUrl?: string | null;
  sceneCard?: { location: string; characterIds: string[]; caption: string; mood: string } | null;
  caption: string;
  people: ScenePerson[];
}) {
  const { t } = useI18n();
  const [broken, setBroken] = useState(false);
  if (imageUrl && !broken) {
    return (
      <figure className="scene-image">
        <a href={imageUrl} target="_blank" rel="noreferrer" aria-label={t('images.openFull')}>
          <img src={imageUrl} alt={caption} loading="lazy" decoding="async" onError={() => setBroken(true)} />
        </a>
        <figcaption className="xsmall muted">
          <Camera aria-hidden className="icon-xs" /> {caption} · {t('images.photoBy')}
        </figcaption>
      </figure>
    );
  }
  const shown = (sceneCard?.characterIds ?? []).map((id) => people.find((p) => p.id === id)).filter((p): p is ScenePerson => Boolean(p));
  const hue = shown[0]?.hue ?? 220;
  return (
    <figure className="scene-card" style={{ '--scene-hue': hue } as React.CSSProperties}>
      <div className="scene-card-art" aria-hidden>
        {broken ? (
          <ImageOff />
        ) : (
          <div className="scene-card-people">
            {shown.slice(0, 3).map((p) => (
              <Avatar key={p.id} name={p.name} hue={p.hue} photoUrl={p.photoUrl} size="lg" decorative />
            ))}
          </div>
        )}
      </div>
      <figcaption>
        <strong className="small block">{sceneCard?.caption ?? caption}</strong>
        {sceneCard?.location && (
          <span className="xsmall muted row">
            <MapPin aria-hidden className="icon-xs" /> {sceneCard.location}
          </span>
        )}
        <span className="xsmall faint block">{t('images.sceneCard')}</span>
      </figcaption>
    </figure>
  );
}
