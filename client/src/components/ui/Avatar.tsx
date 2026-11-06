import { Cog, Eye, Feather, Flame, Leaf, Moon, Sparkles, Star, Waves, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { AvatarGlyph } from '../../../../shared/constants';

const GLYPHS: Partial<Record<AvatarGlyph, LucideIcon>> = {
  spark: Sparkles,
  moon: Moon,
  leaf: Leaf,
  wave: Waves,
  gear: Cog,
  star: Star,
  flame: Flame,
  eye: Eye,
  feather: Feather,
};

export function initials(name: string): string {
  const parts = name
    .replace(/[„“"()]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function hueGradient(hue: number): string {
  return `linear-gradient(135deg, hsl(${hue} 78% 64%) 0%, hsl(${(hue + 36) % 360} 70% 40%) 100%)`;
}

interface AvatarProps {
  name: string;
  hue: number;
  glyph?: AvatarGlyph;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  ring?: boolean | 'muted';
  decorative?: boolean;
  /** Profilfoto oder gezeichnetes Porträt; ohne Bild (oder wenn es nicht lädt) erscheinen Initialen bzw. Symbol. */
  photoUrl?: string | null;
}

export function Avatar({ name, hue, glyph = 'initials', size = 'md', ring, decorative, photoUrl }: AvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const Icon = GLYPHS[glyph];
  const showPhoto = Boolean(photoUrl) && failed !== photoUrl;
  const cls = ['avatar', `avatar-${size}`, ring === true ? 'ring' : ring === 'muted' ? 'ring-muted' : '', showPhoto ? 'has-photo' : ''].join(' ');
  return (
    <span
      className={cls}
      style={{ background: hueGradient(hue) }}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
    >
      {showPhoto ? (
        <img src={photoUrl!} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(photoUrl ?? null)} />
      ) : Icon ? (
        <Icon aria-hidden />
      ) : (
        initials(name)
      )}
    </span>
  );
}
