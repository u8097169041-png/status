/**
 * Bildprompts für möglichst fotorealistische, unauffällige Bilder („wie ein echtes Foto“) statt typischer KI-Illustrationen.
 * Figuren werden immer mit derselben Aussehensbeschreibung eingesetzt; Kamera und Licht variieren, damit sich
 * Szenen nicht wiederholen.
 */
import { uw } from '../../../shared/regex';
import { describeAppearance, type Appearance } from '../../../shared/appearance';
import type { BackendProbe } from './backends';

export const PHOTO_STYLE =
  'candid documentary photograph, shot on a 35mm camera, natural available light, realistic skin texture with pores, ' +
  'subtle film grain, true-to-life colors, shallow depth of field, unposed moment, high detail';

export const PHOTO_NEGATIVE =
  'illustration, painting, drawing, anime, cartoon, 3d render, cgi, digital art, plastic skin, airbrushed, oversaturated, ' +
  'hdr, glossy, watermark, text, logo, signature, frame, deformed hands, extra fingers, extra limbs, distorted face, ' +
  'blurry, lowres, nsfw, nudity, explicit, gore';

export const CAMERA_VARIATIONS = [
  'medium shot at eye level',
  'over-the-shoulder shot',
  'wide shot that shows the surroundings',
  'close-up, 85mm lens',
  'slightly low angle, 35mm lens',
  'seen through a window, reflections on the glass',
  'candid shot from across the room',
  'handheld shot, slight motion blur in the background',
] as const;

export const LIGHT_VARIATIONS = [
  'soft overcast daylight',
  'warm golden-hour light',
  'cool blue hour light',
  'dim tungsten indoor light',
  'neon signs reflecting on wet surfaces',
  'harsh midday sun with deep shadows',
  'candlelight and deep shadows',
  'fluorescent office light',
] as const;

/** Inhalte, für die kein Bild erzeugt wird (sexuelle Darstellungen, Minderjährige, extreme Gewalt). Wortanfänge genügen („Nacktbild“, „Sexszene“). */
const BLOCKED = uw(
  /\b(nackt|nude|naked|nudit|nsfw|sex|porn|erotisch|erotik|erotic|genital|brüste|breast|boobs|topless|oben ohne|unterwäsche|lingerie|dessous|stripp|enthaupt|decapitat|verstümmel|dismember|gore\b|kind(er)?\b.*\b(nackt|gewalt)|child\b|children\b|minderjährig|minor\b|teen(ager)?s?\b)/i,
);

export function isBlockedImageRequest(text: string): boolean {
  return BLOCKED.test(text);
}

/** Bildgrößen passend zur Modellfamilie (Vielfache von 64; SDXL ~1 Megapixel, SD 1.5 ~0,35 Megapixel). */
export function sizeFor(kind: 'portrait' | 'scene' | 'cover', family: BackendProbe['family'], override: { portrait: string; scene: string }): { width: number; height: number } {
  const parse = (s: string) => {
    const m = /^(\d+)x(\d+)$/.exec(s);
    return m ? { width: Math.round(Number(m[1]) / 8) * 8, height: Math.round(Number(m[2]) / 8) * 8 } : null;
  };
  if (kind === 'portrait' && override.portrait) return parse(override.portrait)!;
  if (kind !== 'portrait' && override.scene) return parse(override.scene)!;
  const xl = family === 'sdxl';
  if (kind === 'portrait') return xl ? { width: 896, height: 1152 } : { width: 512, height: 704 };
  if (kind === 'cover') return xl ? { width: 1344, height: 768 } : { width: 768, height: 448 };
  return xl ? { width: 1216, height: 832 } : { width: 768, height: 512 };
}

function clean(text: string, max: number): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/[{}[\]<>|\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function portraitPrompt(appearance: Appearance, context: { role: string; setting: string }): string {
  const place = clean(context.setting, 120) || 'a softly blurred everyday background';
  return [
    `photo portrait of ${describeAppearance(appearance)}`,
    context.role ? `who works as ${clean(context.role, 60)}` : '',
    `head and shoulders, looking slightly past the camera, ${place}`,
    PHOTO_STYLE,
  ]
    .filter(Boolean)
    .join(', ');
}

export interface SceneInput {
  characters: { appearance: Appearance; role?: string }[];
  location: string;
  action: string;
  mood: string;
  extra?: string;
  variation: number;
}

export function scenePrompt(s: SceneInput): string {
  const people = s.characters.slice(0, 3).map((c) => describeAppearance(c.appearance));
  const camera = CAMERA_VARIATIONS[s.variation % CAMERA_VARIATIONS.length];
  const light = LIGHT_VARIATIONS[Math.floor(s.variation / CAMERA_VARIATIONS.length) % LIGHT_VARIATIONS.length];
  return [
    clean(s.action, 280),
    people.length ? `featuring ${people.join('; and ')}` : '',
    s.location ? `location: ${clean(s.location, 120)}` : '',
    s.extra ? clean(s.extra, 200) : '',
    s.mood ? `mood: ${clean(s.mood, 60)}` : '',
    camera,
    light,
    PHOTO_STYLE,
  ]
    .filter(Boolean)
    .join(', ');
}

export function coverPrompt(input: { title: string; setting: string; mood: string; variation: number }): string {
  const camera = CAMERA_VARIATIONS[(input.variation + 2) % CAMERA_VARIATIONS.length];
  return [
    `cinematic establishing photograph of ${clean(input.setting, 220) || clean(input.title, 80)}`,
    input.mood ? `mood: ${clean(input.mood, 60)}` : '',
    'no people in the foreground, wide composition',
    camera,
    LIGHT_VARIATIONS[input.variation % LIGHT_VARIATIONS.length],
    PHOTO_STYLE,
  ]
    .filter(Boolean)
    .join(', ');
}
