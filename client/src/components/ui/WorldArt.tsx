import { useId, useMemo } from 'react';
import type { ArtStyle } from '../../../../shared/constants';
import { createRng } from '../../lib/rng';

interface WorldArtProps {
  seed: string;
  style: ArtStyle;
  hue: number;
  className?: string;
  label?: string;
  /** Eigenes Titelbild; ohne Bild wird die passende Grafik erzeugt. */
  imageUrl?: string | null;
}

const W = 400;
const H = 200;

function hsl(h: number, s: number, l: number, a = 1) {
  return `hsl(${((h % 360) + 360) % 360} ${s}% ${l}% / ${a})`;
}

function hillPath(rng: ReturnType<typeof createRng>, base: number, amplitude: number, segments: number): string {
  const step = W / segments;
  let d = `M0 ${H} L0 ${base + rng.range(-amplitude, amplitude)}`;
  for (let i = 1; i <= segments; i++) {
    const x = i * step;
    const y = base + rng.range(-amplitude, amplitude);
    d += ` Q ${x - step / 2} ${y + rng.range(-amplitude, amplitude)} ${x} ${y}`;
  }
  return `${d} L${W} ${H} Z`;
}

function wavePath(base: number, amplitude: number, wavelength: number, phase: number): string {
  let d = `M0 ${H} L0 ${base}`;
  for (let x = 0; x <= W + wavelength; x += wavelength) {
    d += ` Q ${x + wavelength / 4 + phase} ${base - amplitude} ${x + wavelength / 2 + phase} ${base}`;
    d += ` T ${x + wavelength + phase} ${base}`;
  }
  return `${d} L${W} ${H} Z`;
}

function gearPath(cx: number, cy: number, r: number, teeth: number): string {
  const points: string[] = [];
  const inner = r * 0.82;
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (Math.PI * i) / teeth;
    const radius = i % 2 === 0 ? r : inner;
    const spread = (Math.PI / teeth) * 0.35;
    points.push(`${cx + radius * Math.cos(angle - spread)},${cy + radius * Math.sin(angle - spread)}`);
    points.push(`${cx + radius * Math.cos(angle + spread)},${cy + radius * Math.sin(angle + spread)}`);
  }
  return `M${points.join(' L')} Z`;
}

/** Prozedural erzeugte Titelgrafik einer Welt – deterministisch je Seed. */
export function WorldArt({ imageUrl, ...props }: WorldArtProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        className={`world-cover-img ${props.className ?? ''}`}
        alt={props.label ?? ''}
        aria-hidden={props.label ? undefined : true}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return <GeneratedWorldArt {...props} />;
}

function GeneratedWorldArt({ seed, style, hue, className, label }: Omit<WorldArtProps, 'imageUrl'>) {
  const uid = useId().replace(/:/g, '');
  const content = useMemo(() => {
    const rng = createRng(`${seed}:${style}:${hue}`);
    const sky = `sky-${uid}`;
    const glow = `glow-${uid}`;
    const blur = `blur-${uid}`;
    const els: React.ReactNode[] = [];
    let defs: React.ReactNode = null;

    if (style === 'city') {
      defs = (
        <>
          <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hsl(hue + 230, 45, 7)} />
            <stop offset="0.65" stopColor={hsl(hue, 60, 22)} />
            <stop offset="1" stopColor={hsl(hue + 20, 75, 38)} />
          </linearGradient>
          <radialGradient id={glow}>
            <stop offset="0" stopColor={hsl(hue + 20, 100, 80, 0.9)} />
            <stop offset="1" stopColor={hsl(hue + 20, 100, 60, 0)} />
          </radialGradient>
        </>
      );
      els.push(<rect key="sky" width={W} height={H} fill={`url(#${sky})`} />);
      const mx = rng.range(60, 340);
      els.push(<circle key="glow" cx={mx} cy={55} r={60} fill={`url(#${glow})`} />);
      els.push(<circle key="moon" cx={mx} cy={55} r={16} fill={hsl(hue + 20, 100, 88, 0.9)} />);
      for (const [layer, minH, maxH, light] of [
        [0, 50, 120, 14],
        [1, 30, 90, 8],
      ] as const) {
        let x = -10;
        let i = 0;
        while (x < W) {
          const w = rng.range(layer === 0 ? 16 : 24, layer === 0 ? 34 : 52);
          const h = rng.range(minH, maxH);
          const y = H - h;
          els.push(<rect key={`b${layer}-${i}`} x={x} y={y} width={w + 1} height={h} fill={hsl(hue + 220, 35, light)} />);
          if (layer === 1) {
            for (let wy = y + 8; wy < H - 6; wy += 9) {
              for (let wx = x + 5; wx < x + w - 5; wx += 7) {
                if (rng.next() < 0.33) {
                  els.push(
                    <rect
                      key={`w${i}-${wx}-${wy}`}
                      x={wx}
                      y={wy}
                      width={2.6}
                      height={3.4}
                      fill={hsl(rng.next() < 0.7 ? hue : hue + 160, 100, 70, rng.range(0.4, 0.95))}
                    />,
                  );
                }
              }
            }
          }
          x += w + rng.range(1, 5);
          i++;
        }
      }
      for (let i = 0; i < 60; i++) {
        const x = rng.range(0, W);
        const y = rng.range(0, H);
        els.push(<line key={`r${i}`} x1={x} y1={y} x2={x - 3} y2={y + 10} stroke={hsl(hue, 60, 85, 0.12)} strokeWidth={0.8} />);
      }
    } else if (style === 'cosmic') {
      defs = (
        <>
          <radialGradient id={sky} cx="0.3" cy="0.3" r="1">
            <stop offset="0" stopColor={hsl(hue + 20, 50, 14)} />
            <stop offset="1" stopColor={hsl(hue + 30, 60, 4)} />
          </radialGradient>
          <radialGradient id={glow} cx="0.35" cy="0.35" r="0.75">
            <stop offset="0" stopColor={hsl(hue, 70, 68)} />
            <stop offset="0.6" stopColor={hsl(hue + 15, 60, 32)} />
            <stop offset="1" stopColor={hsl(hue + 30, 70, 10)} />
          </radialGradient>
          <filter id={blur}>
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </>
      );
      els.push(<rect key="sky" width={W} height={H} fill={`url(#${sky})`} />);
      for (let i = 0; i < 3; i++) {
        els.push(
          <ellipse
            key={`n${i}`}
            cx={rng.range(40, 360)}
            cy={rng.range(30, 170)}
            rx={rng.range(60, 120)}
            ry={rng.range(25, 55)}
            fill={hsl(hue + rng.range(-50, 60), 80, 50, 0.32)}
            filter={`url(#${blur})`}
          />,
        );
      }
      for (let i = 0; i < 90; i++) {
        els.push(
          <circle key={`s${i}`} cx={rng.range(0, W)} cy={rng.range(0, H)} r={rng.range(0.3, 1.4)} fill={`rgba(255,255,255,${rng.range(0.3, 0.95)})`} />,
        );
      }
      const px = rng.range(250, 330);
      const py = rng.range(110, 150);
      const pr = rng.range(55, 75);
      els.push(<circle key="planet" cx={px} cy={py} r={pr} fill={`url(#${glow})`} />);
      for (let i = 0; i < 4; i++) {
        els.push(
          <ellipse
            key={`band${i}`}
            cx={px}
            cy={py - pr * 0.5 + i * pr * 0.3}
            rx={pr * Math.sqrt(1 - Math.pow((-0.5 + i * 0.3) * 1, 2)) * 0.98}
            ry={3}
            fill={hsl(hue + 40, 60, 80, 0.12)}
          />,
        );
      }
      els.push(
        <ellipse
          key="ring"
          cx={px}
          cy={py}
          rx={pr * 1.6}
          ry={pr * 0.32}
          fill="none"
          stroke={hsl(hue + 40, 70, 80, 0.45)}
          strokeWidth={2.5}
          transform={`rotate(-14 ${px} ${py})`}
        />,
      );
    } else if (style === 'forest') {
      defs = (
        <>
          <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hsl(hue + 100, 40, 10)} />
            <stop offset="1" stopColor={hsl(hue + 20, 45, 30)} />
          </linearGradient>
          <radialGradient id={glow}>
            <stop offset="0" stopColor={hsl(60, 90, 85, 0.8)} />
            <stop offset="1" stopColor={hsl(60, 90, 70, 0)} />
          </radialGradient>
        </>
      );
      els.push(<rect key="sky" width={W} height={H} fill={`url(#${sky})`} />);
      const mx = rng.range(80, 320);
      els.push(<circle key="glow" cx={mx} cy={50} r={50} fill={`url(#${glow})`} />);
      els.push(<circle key="moon" cx={mx} cy={50} r={13} fill={hsl(55, 80, 90, 0.9)} />);
      [
        [95, 18, 22],
        [125, 14, 16],
        [158, 10, 10],
      ].forEach(([base, amp, light], layer) => {
        els.push(<path key={`h${layer}`} d={hillPath(rng, base, amp, 6)} fill={hsl(hue, 35, light)} />);
        const trees = layer === 2 ? 22 : 14;
        for (let i = 0; i < trees; i++) {
          const x = rng.range(-10, W + 10);
          const h = rng.range(20, 44) * (1 + layer * 0.25);
          const w = h * 0.42;
          const y = base + rng.range(-4, 8);
          els.push(<polygon key={`t${layer}-${i}`} points={`${x},${y - h} ${x - w / 2},${y + 4} ${x + w / 2},${y + 4}`} fill={hsl(hue, 35, light - 2)} />);
        }
      });
      for (let i = 0; i < 26; i++) {
        els.push(<circle key={`f${i}`} cx={rng.range(0, W)} cy={rng.range(90, 190)} r={rng.range(0.8, 1.8)} fill={hsl(70, 100, 70, rng.range(0.5, 1))} />);
      }
    } else if (style === 'ocean') {
      defs = (
        <>
          <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hsl(hue + 40, 50, 12)} />
            <stop offset="0.55" stopColor={hsl(hue + 10, 55, 34)} />
            <stop offset="1" stopColor={hsl(hue - 20, 70, 55)} />
          </linearGradient>
          <radialGradient id={glow}>
            <stop offset="0" stopColor={hsl(45, 100, 85, 0.9)} />
            <stop offset="1" stopColor={hsl(45, 100, 70, 0)} />
          </radialGradient>
        </>
      );
      els.push(<rect key="sky" width={W} height={H} fill={`url(#${sky})`} />);
      const sx = rng.range(90, 310);
      els.push(<circle key="glow" cx={sx} cy={92} r={60} fill={`url(#${glow})`} />);
      els.push(<circle key="sun" cx={sx} cy={92} r={20} fill={hsl(45, 100, 88, 0.95)} />);
      const ix = rng.range(30, 120);
      els.push(<path key="island" d={`M${ix - 40} 112 Q ${ix} ${88} ${ix + 50} 112 Z`} fill={hsl(hue + 30, 40, 14)} />);
      els.push(<rect key="lh" x={ix + 6} y={78} width={6} height={22} fill={hsl(hue + 30, 30, 85)} />);
      els.push(<circle key="lhl" cx={ix + 9} cy={77} r={4} fill={hsl(50, 100, 75)} />);
      [
        [110, 4, 46, 30],
        [130, 6, 60, 24],
        [152, 7, 70, 18],
        [175, 8, 90, 12],
      ].forEach(([base, amp, len, light], i) => {
        els.push(<path key={`wv${i}`} d={wavePath(base, amp, len, rng.range(-30, 0))} fill={hsl(hue, 60, light, 0.95)} />);
      });
      for (let i = 0; i < 12; i++) {
        els.push(<rect key={`ref${i}`} x={sx - rng.range(5, 30)} y={115 + i * 6} width={rng.range(10, 60)} height={1.4} fill={hsl(45, 100, 85, 0.35)} />);
      }
    } else if (style === 'gears') {
      defs = (
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hsl(hue + 200, 25, 10)} />
          <stop offset="0.7" stopColor={hsl(hue, 55, 26)} />
          <stop offset="1" stopColor={hsl(hue + 10, 75, 45)} />
        </linearGradient>
      );
      els.push(<rect key="sky" width={W} height={H} fill={`url(#${sky})`} />);
      for (let i = 0; i < 4; i++) {
        const cx = rng.range(20, 380);
        const cy = rng.range(110, 210);
        const r = rng.range(30, 70);
        els.push(<path key={`g${i}`} d={gearPath(cx, cy, r, rng.int(9, 14))} fill={hsl(hue, 40, rng.range(12, 20))} />);
        els.push(<circle key={`gh${i}`} cx={cx} cy={cy} r={r * 0.3} fill={hsl(hue + 200, 25, 10)} />);
      }
      for (let i = 0; i < 6; i++) {
        els.push(<circle key={`sm${i}`} cx={rng.range(0, W)} cy={rng.range(20, 90)} r={rng.range(12, 28)} fill={hsl(hue, 20, 70, 0.08)} />);
      }
      const ax = rng.range(120, 280);
      const ay = rng.range(40, 70);
      els.push(<ellipse key="ship" cx={ax} cy={ay} rx={44} ry={14} fill={hsl(hue, 50, 55)} />);
      els.push(<ellipse key="shipHi" cx={ax - 6} cy={ay - 4} rx={30} ry={5} fill={hsl(hue, 70, 75, 0.5)} />);
      els.push(<rect key="gondola" x={ax - 12} y={ay + 14} width={24} height={7} rx={2} fill={hsl(hue + 10, 40, 22)} />);
      els.push(<line key="rope1" x1={ax - 10} y1={ay + 12} x2={ax - 8} y2={ay + 15} stroke={hsl(hue, 30, 30)} />);
      els.push(<line key="rope2" x1={ax + 10} y1={ay + 12} x2={ax + 8} y2={ay + 15} stroke={hsl(hue, 30, 30)} />);
    } else if (style === 'capital') {
      // Regierungsviertel: Kuppelbau mit Säulen, Fahnen und Abendhimmel
      defs = (
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hsl(hue + 210, 40, 10)} />
          <stop offset="0.7" stopColor={hsl(hue, 55, 30)} />
          <stop offset="1" stopColor={hsl(hue + 20, 70, 52)} />
        </linearGradient>
      );
      els.push(<rect key="sky" width={W} height={H} fill={`url(#${sky})`} />);
      for (let i = 0; i < 30; i++) {
        els.push(<circle key={`st${i}`} cx={rng.range(0, W)} cy={rng.range(0, 80)} r={rng.range(0.4, 1.2)} fill={hsl(hue, 30, 90, rng.range(0.3, 0.8))} />);
      }
      els.push(<path key="far" d={hillPath(rng, 165, 6, 6)} fill={hsl(hue + 210, 30, 14)} />);
      const cx = rng.range(150, 250);
      const body = hsl(hue + 200, 15, 78);
      const shade = hsl(hue + 200, 20, 58);
      els.push(<rect key="base" x={cx - 110} y={150} width={220} height={50} fill={shade} />);
      els.push(<rect key="hall" x={cx - 70} y={112} width={140} height={40} fill={body} />);
      els.push(<path key="pediment" d={`M${cx - 78} 112 L${cx} 92 L${cx + 78} 112 Z`} fill={body} />);
      for (let i = 0; i < 8; i++) {
        els.push(<rect key={`col${i}`} x={cx - 62 + i * 17} y={116} width={6} height={34} fill={shade} />);
      }
      els.push(<rect key="drum" x={cx - 26} y={74} width={52} height={20} fill={body} />);
      els.push(<path key="dome" d={`M${cx - 30} 76 Q ${cx} 30 ${cx + 30} 76 Z`} fill={hsl(hue, 30, 70)} />);
      els.push(<line key="pole" x1={cx} y1={42} x2={cx} y2={22} stroke={body} strokeWidth={1.5} />);
      els.push(<rect key="flag" x={cx} y={22} width={14} height={8} fill={hsl(hue + 180, 70, 55)} />);
      for (let i = 0; i < 12; i++) {
        els.push(<rect key={`win${i}`} x={cx - 100 + i * 17} y={160} width={6} height={10} fill={hsl(45, 100, 75, rng.range(0.3, 0.9))} />);
      }
    } else if (style === 'stage') {
      // Bühne: Vorhänge, Scheinwerferkegel und Publikum
      defs = (
        <>
          <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hsl(hue + 240, 35, 6)} />
            <stop offset="1" stopColor={hsl(hue, 55, 18)} />
          </linearGradient>
          <linearGradient id={glow} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hsl(hue + 30, 100, 85, 0.55)} />
            <stop offset="1" stopColor={hsl(hue + 30, 100, 70, 0)} />
          </linearGradient>
        </>
      );
      els.push(<rect key="sky" width={W} height={H} fill={`url(#${sky})`} />);
      for (let i = 0; i < 3; i++) {
        const x = 90 + i * 110 + rng.range(-20, 20);
        els.push(<path key={`beam${i}`} d={`M${x} 0 L${x - 45} 150 L${x + 45} 150 Z`} fill={`url(#${glow})`} />);
      }
      els.push(<rect key="stage" x={0} y={140} width={W} height={18} fill={hsl(hue, 40, 26)} />);
      els.push(<path key="curtainL" d={`M0 0 L70 0 Q 40 80 60 140 L0 140 Z`} fill={hsl(hue + 340, 65, 32)} />);
      els.push(<path key="curtainR" d={`M${W} 0 L${W - 70} 0 Q ${W - 40} 80 ${W - 60} 140 L${W} 140 Z`} fill={hsl(hue + 340, 65, 32)} />);
      els.push(<rect key="valance" x={0} y={0} width={W} height={16} fill={hsl(hue + 340, 60, 26)} />);
      els.push(<circle key="mic" cx={rng.range(170, 230)} cy={118} r={5} fill={hsl(hue, 20, 75)} />);
      for (let i = 0; i < 26; i++) {
        const x = i * 16 + rng.range(-3, 3);
        els.push(<circle key={`head${i}`} cx={x} cy={rng.range(178, 186)} r={rng.range(7, 10)} fill={hsl(hue + 240, 30, rng.range(5, 10))} />);
      }
    } else if (style === 'stadium') {
      // Stadion: Flutlichtmasten, Tribünen und Rasen
      defs = (
        <>
          <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hsl(hue + 200, 45, 8)} />
            <stop offset="1" stopColor={hsl(hue + 180, 40, 22)} />
          </linearGradient>
          <radialGradient id={glow}>
            <stop offset="0" stopColor={hsl(60, 100, 92, 0.9)} />
            <stop offset="1" stopColor={hsl(60, 100, 80, 0)} />
          </radialGradient>
        </>
      );
      els.push(<rect key="sky" width={W} height={H} fill={`url(#${sky})`} />);
      for (const x of [40, W - 40]) {
        els.push(<line key={`mast${x}`} x1={x} y1={30} x2={x} y2={120} stroke={hsl(hue + 200, 15, 40)} strokeWidth={3} />);
        els.push(<circle key={`halo${x}`} cx={x} cy={30} r={40} fill={`url(#${glow})`} />);
        els.push(<rect key={`lamp${x}`} x={x - 12} y={24} width={24} height={10} fill={hsl(60, 100, 88)} />);
      }
      els.push(<path key="standBack" d={`M0 120 Q ${W / 2} 70 ${W} 120 L${W} 140 L0 140 Z`} fill={hsl(hue + 200, 25, 16)} />);
      for (let i = 0; i < 90; i++) {
        els.push(<circle key={`fan${i}`} cx={rng.range(0, W)} cy={rng.range(110, 138)} r={1.4} fill={hsl(rng.next() < 0.5 ? hue : hue + 180, 80, 60, 0.7)} />);
      }
      els.push(<rect key="pitch" x={0} y={140} width={W} height={60} fill={hsl(hue, 55, 30)} />);
      for (let i = 0; i < 6; i++) {
        els.push(<rect key={`stripe${i}`} x={i * 70} y={140} width={35} height={60} fill={hsl(hue, 55, 34)} />);
      }
      els.push(<line key="half" x1={W / 2} y1={140} x2={W / 2} y2={H} stroke={hsl(hue, 20, 85, 0.7)} strokeWidth={1.5} />);
      els.push(<ellipse key="circle" cx={W / 2} cy={172} rx={40} ry={14} fill="none" stroke={hsl(hue, 20, 85, 0.7)} strokeWidth={1.5} />);
    } else if (style === 'romance') {
      // Dating: Abendhimmel, Lichterkette über den Dächern, warme Fenster und schwebende Herzen
      defs = (
        <>
          <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hsl(hue + 250, 45, 16)} />
            <stop offset="0.6" stopColor={hsl(hue, 55, 38)} />
            <stop offset="1" stopColor={hsl(hue + 25, 75, 62)} />
          </linearGradient>
          <radialGradient id={glow}>
            <stop offset="0" stopColor={hsl(45, 100, 80, 0.95)} />
            <stop offset="1" stopColor={hsl(45, 100, 70, 0)} />
          </radialGradient>
        </>
      );
      els.push(<rect key="sky" width={W} height={H} fill={`url(#${sky})`} />);
      els.push(<circle key="moon" cx={rng.range(60, W - 60)} cy={rng.range(28, 50)} r={14} fill={hsl(45, 90, 90, 0.9)} />);
      for (let i = 0; i < 30; i++) {
        els.push(<circle key={`st${i}`} cx={rng.range(0, W)} cy={rng.range(0, H * 0.45)} r={rng.range(0.4, 1.3)} fill="white" opacity={rng.range(0.3, 0.9)} />);
      }
      // Dächer mit warm beleuchteten Fenstern
      let x = 0;
      let b = 0;
      while (x < W) {
        const w = rng.range(36, 70);
        const h = rng.range(55, 95);
        const roof = rng.range(8, 20);
        els.push(
          <path key={`h${b}`} d={`M${x} ${H} L${x} ${H - h} L${x + w / 2} ${H - h - roof} L${x + w} ${H - h} L${x + w} ${H} Z`} fill={hsl(hue + 250, 35, 12)} />,
        );
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 2; c++) {
            if (rng.next() < 0.55) {
              els.push(
                <rect key={`w${b}-${r}-${c}`} x={x + 8 + c * (w / 2 - 4)} y={H - h + 10 + r * 18} width={8} height={10} rx={1.5} fill={hsl(40, 95, rng.range(60, 75))} opacity={0.9} />,
              );
            }
          }
        }
        x += w + rng.range(2, 6);
        b++;
      }
      // Lichterkette
      const sag = rng.range(18, 30);
      const y0 = rng.range(70, 90);
      els.push(<path key="wire" d={`M0 ${y0} Q ${W / 2} ${y0 + sag * 2} ${W} ${y0}`} stroke={hsl(hue + 250, 20, 20)} strokeWidth={1.2} fill="none" />);
      for (let i = 1; i < 16; i++) {
        const t = i / 16;
        const lx = t * W;
        const ly = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
        els.push(<circle key={`lg${i}`} cx={lx} cy={ly + 4} r={9} fill={`url(#${glow})`} />);
        els.push(<circle key={`lb${i}`} cx={lx} cy={ly + 4} r={2.4} fill={hsl(i % 3 === 0 ? 340 : 45, 100, 78)} />);
      }
      // Herzen
      for (let i = 0; i < 5; i++) {
        const hx = rng.range(20, W - 20);
        const hy = rng.range(20, y0 - 10);
        const s = rng.range(4, 8);
        els.push(
          <path
            key={`hz${i}`}
            d={`M${hx} ${hy + s * 0.9} C ${hx - s * 1.6} ${hy - s * 0.2}, ${hx - s * 0.8} ${hy - s * 1.4}, ${hx} ${hy - s * 0.5} C ${hx + s * 0.8} ${hy - s * 1.4}, ${hx + s * 1.6} ${hy - s * 0.2}, ${hx} ${hy + s * 0.9} Z`}
            fill={hsl(345, 85, 70)}
            opacity={rng.range(0.45, 0.85)}
          />,
        );
      }
    } else if (style === 'network') {
      // Internet: leuchtende Knoten, Verbindungen und schwebende Bildschirme
      defs = (
        <>
          <linearGradient id={sky} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={hsl(hue + 220, 45, 8)} />
            <stop offset="1" stopColor={hsl(hue, 60, 20)} />
          </linearGradient>
          <radialGradient id={glow}>
            <stop offset="0" stopColor={hsl(hue, 100, 75, 0.9)} />
            <stop offset="1" stopColor={hsl(hue, 100, 60, 0)} />
          </radialGradient>
        </>
      );
      els.push(<rect key="sky" width={W} height={H} fill={`url(#${sky})`} />);
      const nodes = Array.from({ length: 16 }, () => ({ x: rng.range(10, W - 10), y: rng.range(10, H - 10), r: rng.range(2, 5) }));
      nodes.forEach((a, i) => {
        nodes.slice(i + 1).forEach((b, j) => {
          if (Math.hypot(a.x - b.x, a.y - b.y) < 110 && rng.next() < 0.6) {
            els.push(<line key={`l${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hsl(hue, 80, 65, 0.25)} strokeWidth={1} />);
          }
        });
      });
      nodes.forEach((n, i) => {
        els.push(<circle key={`h${i}`} cx={n.x} cy={n.y} r={n.r * 4} fill={`url(#${glow})`} />);
        els.push(<circle key={`n${i}`} cx={n.x} cy={n.y} r={n.r} fill={hsl(rng.next() < 0.3 ? hue + 160 : hue, 100, 75)} />);
      });
      for (let i = 0; i < 3; i++) {
        const x = rng.range(30, W - 110);
        const y = rng.range(30, H - 80);
        const w = rng.range(70, 100);
        els.push(<rect key={`s${i}`} x={x} y={y} width={w} height={w * 0.6} rx={6} fill={hsl(hue + 220, 40, 12, 0.85)} stroke={hsl(hue, 80, 65, 0.6)} />);
        els.push(<rect key={`sb${i}`} x={x + 8} y={y + 8} width={w * 0.5} height={4} rx={2} fill={hsl(hue, 90, 70, 0.8)} />);
        els.push(<rect key={`sc${i}`} x={x + 8} y={y + 18} width={w * 0.7} height={3} rx={1.5} fill={hsl(hue, 30, 80, 0.4)} />);
        els.push(<circle key={`sh${i}`} cx={x + w - 14} cy={y + w * 0.6 - 12} r={5} fill={hsl(340, 90, 65)} />);
      }
    } else {
      // dunes
      defs = (
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hsl(hue + 230, 40, 14)} />
          <stop offset="0.6" stopColor={hsl(hue, 70, 40)} />
          <stop offset="1" stopColor={hsl(hue + 15, 85, 62)} />
        </linearGradient>
      );
      els.push(<rect key="sky" width={W} height={H} fill={`url(#${sky})`} />);
      const sx = rng.range(80, 320);
      els.push(<circle key="sun" cx={sx} cy={100} r={36} fill={hsl(hue + 25, 100, 70, 0.9)} />);
      [
        [120, 14, 30],
        [145, 16, 22],
        [170, 12, 14],
      ].forEach(([base, amp, light], i) => {
        els.push(<path key={`d${i}`} d={hillPath(rng, base, amp, 3)} fill={hsl(hue, 55, light)} />);
      });
    }
    return { defs, els };
  }, [seed, style, hue, uid]);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>{content.defs}</defs>
      {content.els}
    </svg>
  );
}
