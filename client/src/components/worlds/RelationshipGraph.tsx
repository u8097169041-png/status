import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CharacterSummary, RelationshipDto } from '../../../../shared/types';
import { useI18n } from '../../i18n';
import { initials } from '../ui/Avatar';

const STATUS_COLORS: Record<RelationshipDto['status'], string> = {
  close: '#4ade80',
  friendly: '#a3e635',
  neutral: '#94a3b8',
  strained: '#fbbf24',
  hostile: '#fb7185',
};

/** Kreisförmiges Beziehungsnetz der Bewohner einer Welt (SVG, ohne externe Bibliothek). */
export function RelationshipGraph({ characters, relationships }: { characters: CharacterSummary[]; relationships: RelationshipDto[] }) {
  const { t, td } = useI18n();
  const navigate = useNavigate();
  const [focus, setFocus] = useState<string | null>(null);
  const size = 360;
  const center = size / 2;
  const radius = characters.length <= 2 ? 90 : 130;
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    characters.forEach((c, i) => {
      const angle = (2 * Math.PI * i) / Math.max(1, characters.length) - Math.PI / 2;
      map.set(c.id, { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) });
    });
    return map;
  }, [characters, center, radius]);

  if (characters.length === 0) return null;

  return (
    <figure className="graph">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t('worlds.graph')}>
        {relationships.map((r) => {
          const a = positions.get(r.a.id);
          const b = positions.get(r.b.id);
          if (!a || !b) return null;
          const dim = focus && focus !== r.a.id && focus !== r.b.id;
          return (
            <line
              key={r.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={STATUS_COLORS[r.status]}
              strokeWidth={1.5 + (Math.abs(r.affinity) / 100) * 4}
              strokeOpacity={dim ? 0.12 : 0.75}
              strokeDasharray={r.affinity < 0 ? '6 4' : undefined}
            >
              <title>
                {r.a.name} & {r.b.name}: {td(`relationshipKinds.${r.kind}`, r.kind)}, {td(`relationshipStatus.${r.status}`, r.status)} (
                {r.affinity})
              </title>
            </line>
          );
        })}
        {characters.map((c) => {
          const p = positions.get(c.id)!;
          const dim = focus && focus !== c.id && !relationships.some((r) => (r.a.id === focus && r.b.id === c.id) || (r.b.id === focus && r.a.id === c.id));
          return (
            <g
              key={c.id}
              className="graph-node"
              transform={`translate(${p.x} ${p.y})`}
              opacity={dim ? 0.35 : 1}
              tabIndex={0}
              role="link"
              aria-label={c.name}
              onMouseEnter={() => setFocus(c.id)}
              onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(c.id)}
              onBlur={() => setFocus(null)}
              onClick={() => navigate(`/characters/${c.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/characters/${c.id}`);
              }}
            >
              <circle r={22} fill={`hsl(${c.avatarHue} 70% 50%)`} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
              <text textAnchor="middle" dy="0.35em" fontSize="13" fontWeight="700" fill="#fff">
                {initials(c.name)}
              </text>
              <text textAnchor="middle" y={38} fontSize="11" fill="#c9cde6">
                {c.name.length > 16 ? `${c.name.slice(0, 15)}…` : c.name}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="graph-legend">
        {(Object.keys(STATUS_COLORS) as RelationshipDto['status'][]).map((s) => (
          <span key={s} className="row xsmall">
            <span className="legend-swatch" style={{ background: STATUS_COLORS[s] }} />
            {td(`relationshipStatus.${s}`, s)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function statusColor(status: RelationshipDto['status']): string {
  return STATUS_COLORS[status];
}
