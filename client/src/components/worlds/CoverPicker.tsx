import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ArtStyle } from '../../../../shared/constants';
import { useI18n, type TKey } from '../../i18n';
import { COVER_ACCEPT, ImageError, prepareCoverImage } from '../../lib/images';
import { WorldArt } from '../ui/WorldArt';

/** Zustand des Titelbilds im Editor: unverändert, neu ausgewählt (noch nicht gespeichert) oder zu entfernen. */
export type CoverState = { kind: 'keep'; url: string | null } | { kind: 'new'; blob: Blob; url: string } | { kind: 'remove' };

export function coverPreviewUrl(cover: CoverState): string | null {
  return cover.kind === 'remove' ? null : cover.url;
}

/** Bildauswahl mit Vorschau, Ersetzen und Entfernen. Gespeichert wird erst zusammen mit der Welt. */
export function CoverPicker({
  cover,
  onChange,
  seed,
  artStyle,
  hue,
}: {
  cover: CoverState;
  onChange: (cover: CoverState) => void;
  seed: string;
  artStyle: ArtStyle;
  hue: number;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = coverPreviewUrl(cover);
  const newUrl = cover.kind === 'new' ? cover.url : null;

  // Vorschau-URLs nicht gespeicherter Bilder wieder freigeben.
  useEffect(() => {
    return () => {
      if (newUrl) URL.revokeObjectURL(newUrl);
    };
  }, [newUrl]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await prepareCoverImage(file);
      onChange({ kind: 'new', blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      setError(t(`cover.error_${e instanceof ImageError ? e.code : 'unreadable'}` as TKey));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="cover-picker stack-sm">
      <WorldArt seed={seed} style={artStyle} hue={hue} imageUrl={preview} className="world-preview-art" label={t('cover.preview')} />
      <span className="field-label">{t('cover.title')}</span>
      <div className="row wrap">
        <input
          ref={inputRef}
          type="file"
          accept={COVER_ACCEPT.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void pick(e.target.files?.[0])}
          data-testid="cover-input"
        />
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} aria-describedby={hintId} onClick={() => inputRef.current?.click()}>
          {busy ? <span className="spinner" aria-hidden /> : preview ? <RefreshCw aria-hidden /> : <ImagePlus aria-hidden />}
          {preview ? t('cover.replace') : t('cover.choose')}
        </button>
        {preview && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onChange({ kind: 'remove' })}>
            <Trash2 aria-hidden /> {t('cover.remove')}
          </button>
        )}
      </div>
      <span id={hintId} className="field-hint">
        {cover.kind === 'new' ? t('cover.pending') : t('cover.hint')}
      </span>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
