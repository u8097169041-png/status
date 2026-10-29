/**
 * Eigene Titelbilder für Welten. Bilder liegen als Dateien im Upload-Ordner (data/uploads/covers),
 * die Datenbank speichert nur den Dateinamen. Dateinamen erzeugt ausschließlich der Server.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppContext } from '../context';
import { get, run } from '../db/database';
import { AppError, badRequest, forbidden, notFound } from '../lib/errors';

export const COVER_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
export type CoverType = keyof typeof COVER_TYPES;
/** Obergrenze je Bild. Der Client verkleinert Bilder vorher; das hier ist die serverseitige Absicherung. */
export const MAX_COVER_BYTES = 3 * 1024 * 1024;
const FILE_RE = /^[A-Za-z0-9_-]{1,80}-[a-f0-9]{16}\.(jpg|png|webp)$/;
const CONTENT_TYPE_BY_EXT: Record<string, CoverType> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export function coversDir(ctx: AppContext): string {
  return join(ctx.config.uploadsDir, 'covers');
}

export function coverUrlOf(file: string | null): string | null {
  return file && FILE_RE.test(file) ? `/api/media/covers/${file}` : null;
}

/** Erkennt das Format an den ersten Bytes – die Angabe des Browsers allein reicht nicht. */
export function detectImageType(buf: Buffer): CoverType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function editableWorld(ctx: AppContext, worldId: string): { cover_image: string | null } {
  const row = get<{ is_custom: number; cover_image: string | null }>(ctx.db, 'SELECT is_custom, cover_image FROM worlds WHERE id = ?', worldId);
  if (!row) throw notFound('Welt');
  if (!row.is_custom) throw forbidden('Vorgefertigte Welten können nicht bearbeitet werden.');
  return row;
}

function removeFile(ctx: AppContext, file: string | null): void {
  if (!file || !FILE_RE.test(file)) return;
  try {
    rmSync(join(coversDir(ctx), file), { force: true });
  } catch (error) {
    console.warn('[covers] Datei konnte nicht gelöscht werden:', (error as Error).message);
  }
}

/** Speichert ein neues Titelbild. Erst nach erfolgreichem Schreiben wird die Datenbank aktualisiert. */
export function setWorldCover(ctx: AppContext, worldId: string, contentType: string | undefined, body: unknown): string {
  const row = editableWorld(ctx, worldId);
  const declared = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if (!(declared in COVER_TYPES)) throw badRequest('invalid_image_type', 'Erlaubt sind nur JPEG-, PNG- und WebP-Bilder.');
  if (!Buffer.isBuffer(body) || body.length === 0) throw badRequest('empty_image', 'Es wurde kein Bild übertragen.');
  if (body.length > MAX_COVER_BYTES) throw new AppError(413, 'image_too_large', 'Das Bild ist zu groß (höchstens 3 MB).');
  const detected = detectImageType(body);
  if (!detected) throw badRequest('invalid_image', 'Die Datei ist kein gültiges JPEG-, PNG- oder WebP-Bild.');
  if (detected !== declared) throw badRequest('invalid_image', 'Dateiinhalt und Dateityp passen nicht zusammen.');

  const dir = coversDir(ctx);
  const file = `${worldId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) || 'world'}-${randomBytes(8).toString('hex')}.${COVER_TYPES[detected]}`;
  const target = join(dir, file);
  const temp = `${target}.tmp`;
  try {
    mkdirSync(dir, { recursive: true });
    // Erst vollständig schreiben, dann umbenennen: Es entstehen keine halbfertigen Bilder.
    writeFileSync(temp, body, { flag: 'wx' });
    renameSync(temp, target);
  } catch (error) {
    rmSync(temp, { force: true });
    const code = (error as NodeJS.ErrnoException).code;
    console.warn('[covers] Speichern fehlgeschlagen:', code ?? (error as Error).message);
    throw new AppError(
      507,
      'storage_failed',
      code === 'ENOSPC' ? 'Nicht genug Speicherplatz für das Bild.' : 'Das Bild konnte nicht gespeichert werden.',
    );
  }
  run(ctx.db, 'UPDATE worlds SET cover_image = ? WHERE id = ?', file, worldId);
  removeFile(ctx, row.cover_image);
  return coverUrlOf(file)!;
}

export function removeWorldCover(ctx: AppContext, worldId: string): void {
  const row = editableWorld(ctx, worldId);
  run(ctx.db, 'UPDATE worlds SET cover_image = NULL WHERE id = ?', worldId);
  removeFile(ctx, row.cover_image);
}

/** Pfad und Typ einer gespeicherten Bilddatei – nur für gültige, vom Server vergebene Namen. */
export function coverFile(ctx: AppContext, file: string): { path: string; contentType: CoverType } {
  if (!FILE_RE.test(file)) throw notFound('Bild');
  const path = join(coversDir(ctx), file);
  if (!existsSync(path)) throw notFound('Bild');
  return { path, contentType: CONTENT_TYPE_BY_EXT[file.split('.').pop() ?? ''] };
}

/** Beim Löschen einer Welt bzw. aller Daten die zugehörigen Dateien entfernen. */
export function deleteCoverFile(ctx: AppContext, file: string | null): void {
  removeFile(ctx, file);
}

export function deleteAllCovers(ctx: AppContext): void {
  const dir = coversDir(ctx);
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (FILE_RE.test(name) || name.endsWith('.tmp')) rmSync(join(dir, name), { force: true });
  }
}
