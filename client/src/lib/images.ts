/**
 * Aufbereitung eigener Weltbilder im Browser: Typ- und Größenprüfung, Verkleinerung und Neukodierung.
 * Die Neukodierung entfernt dabei auch Bildmetadaten (z. B. GPS-Standort aus Handyfotos).
 */
export const COVER_ACCEPT = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Größte auswählbare Datei (vor dem Verkleinern). */
export const MAX_INPUT_BYTES = 15 * 1024 * 1024;
/** Größte hochgeladene Datei (nach dem Verkleinern); der Server erlaubt 3 MB. */
const MAX_OUTPUT_BYTES = 2.5 * 1024 * 1024;
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1000;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 160;

export type ImageErrorCode = 'type' | 'too_large' | 'unreadable' | 'too_small' | 'encode';

export class ImageError extends Error {
  constructor(public readonly code: ImageErrorCode) {
    super(code);
    this.name = 'ImageError';
  }
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Ältere Browser: über ein <img>-Element versuchen.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ImageError('unreadable'));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageError('unreadable');
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Prüft und verkleinert ein ausgewähltes Bild auf höchstens 1600 × 1000 Pixel (WebP, sonst JPEG). */
export async function prepareCoverImage(file: File): Promise<Blob> {
  if (!(COVER_ACCEPT as readonly string[]).includes(file.type)) throw new ImageError('type');
  if (file.size > MAX_INPUT_BYTES) throw new ImageError('too_large');
  const image = await decode(file);
  try {
    if (image.width < MIN_WIDTH || image.height < MIN_HEIGHT) throw new ImageError('too_small');
    const scale = Math.min(1, MAX_WIDTH / image.width, MAX_HEIGHT / image.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError('encode');
    // Dunkler Hintergrund für transparente Bilder (passt zum Design, auch bei JPEG ohne Transparenz).
    ctx.fillStyle = '#0d1020';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    for (const [type, quality] of [
      ['image/webp', 0.85],
      ['image/jpeg', 0.85],
      ['image/jpeg', 0.7],
    ] as const) {
      const blob = await toBlob(canvas, type, quality);
      // Manche Browser liefern statt WebP stillschweigend PNG – dann das nächste Format versuchen.
      if (blob && blob.type === type && blob.size <= MAX_OUTPUT_BYTES) return blob;
    }
    throw new ImageError('encode');
  } finally {
    image.close();
  }
}
