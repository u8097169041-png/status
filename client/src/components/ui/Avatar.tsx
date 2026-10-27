import { Cog, Eye, Feather, Flame, Leaf, Moon, Sparkles, Star, Waves, type LucideIcon } from 'lucide-react';
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
}

export function Avatar({ name, hue, glyph = 'initials', size = 'md', ring, decorative }: AvatarProps) {
  const Icon = GLYPHS[glyph];
  const cls = ['avatar', `avatar-${size}`, ring === true ? 'ring' : ring === 'muted' ? 'ring-muted' : ''].join(' ');
  return (
    <span
      className={cls}
      style={{ background: hueGradient(hue) }}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
    >
      {Icon ? <Icon aria-hidden /> : initials(name)}
    </span>
  );
}
