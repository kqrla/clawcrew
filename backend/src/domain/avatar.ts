/**
 * docs/50. an avatar per seat, generated not drawn.
 *
 * a remake of the plush bot-avatar idea with the dials exposed: more body shapes, and every
 * part (shape, hue, eyes, mouth, hat, glasses, antenna, blush) chosen by a seed, overridable
 * one at a time. deterministic, so a seat looks the same in a log, on the board, and in a
 * screenshot from three weeks ago.
 */
export type ShapeName =
  | 'circle' | 'square' | 'hexagon' | 'triangle' | 'diamond' | 'clover' | 'star' | 'drop'
  | 'pill' | 'pebble' | 'puddle' | 'ghost' | 'cloud' | 'shield' | 'bell' | 'gem'
  | 'trapezoid' | 'flower' | 'cat' | 'droid' | 'mech' | 'alien' | 'leaf' | 'kite'
  | 'gear' | 'bolt' | 'capsule' | 'notch' | 'wave' | 'blob';

export interface AvatarSpec {
  seed: string;
  shape?: ShapeName;
  hue?: number;
  face?: 'eyes' | 'mouth';
  hat?: 'none' | 'beret' | 'beanie' | 'party' | 'crown' | 'horns' | 'halo';
  glasses?: 'none' | 'round' | 'square' | 'shades';
  antenna?: 'none' | 'stub' | 'loop' | 'double';
  blush?: boolean;
}

export interface AvatarParts {
  shape: ShapeName;
  hue: number;
  face: 'eyes' | 'mouth';
  hat: AvatarSpec['hat'];
  glasses: AvatarSpec['glasses'];
  antenna: AvatarSpec['antenna'];
  blush: boolean;
  eyeGap: number;
  eyeSize: number;
}

const SHAPES: ShapeName[] = [
  'circle', 'square', 'hexagon', 'triangle', 'diamond', 'clover', 'star', 'drop', 'pill', 'pebble',
  'puddle', 'ghost', 'cloud', 'shield', 'bell', 'gem', 'trapezoid', 'flower', 'cat', 'droid', 'mech',
  'alien', 'leaf', 'kite', 'gear', 'bolt', 'capsule', 'notch', 'wave', 'blob',
];
const HATS: AvatarParts['hat'][] = ['none', 'none', 'beret', 'beanie', 'party', 'crown', 'horns', 'halo'];
const GLASSES: AvatarParts['glasses'][] = ['none', 'none', 'none', 'round', 'square', 'shades'];
const ANTENNAE: AvatarParts['antenna'][] = ['none', 'none', 'stub', 'loop', 'double'];

/** fnv-1a, then xorshift: a seed string in, a repeatable stream of choices out */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function stream(seed: number): () => number {
  let x = seed || 0x9e3779b9;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 0xffffffff;
  };
}

const pick = <T>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length) % xs.length]!;

export function partsFor(spec: AvatarSpec): AvatarParts {
  const r = stream(hash(spec.seed));
  // every draw happens whether or not it is overridden: pinning the hat must not reshuffle the
  // eyes, which is what happens when an override short-circuits the stream
  const shape = pick(r, SHAPES);
  const hue = Math.floor(r() * 360);
  const face = pick(r, ['eyes', 'mouth'] as const);
  const hat = pick(r, HATS);
  const glasses = pick(r, GLASSES);
  const antenna = pick(r, ANTENNAE);
  const blush = r() > 0.55;
  const eyeGap = 14 + Math.floor(r() * 5);
  const eyeSize = 4 + Math.floor(r() * 3);
  return {
    shape: spec.shape ?? shape,
    hue: spec.hue ?? hue,
    face: spec.face ?? face,
    hat: spec.hat ?? hat,
    glasses: spec.glasses ?? glasses,
    antenna: spec.antenna ?? antenna,
    blush: spec.blush ?? blush,
    eyeGap,
    eyeSize,
  };
}

/** body outlines in a 100x100 box, so every shape shares one face rig */
function body(shape: ShapeName, fill: string, stroke: string): string {
  const at = 'fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"';
  const poly = (pts: string): string => `<polygon points="${pts}" ${at} />`;
  const ring = (n: number, radius: number, cx = 50, cy = 54, phase = -90): string => {
    const pts: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const a = ((phase + (360 / n) * i) * Math.PI) / 180;
      pts.push(`${(cx + Math.cos(a) * radius).toFixed(1)},${(cy + Math.sin(a) * radius).toFixed(1)}`);
    }
    return pts.join(' ');
  };
  switch (shape) {
    case 'circle': return `<circle cx="50" cy="54" r="38" ${at} />`;
    case 'square': return `<rect x="14" y="18" width="72" height="72" rx="12" ${at} />`;
    case 'hexagon': return poly(ring(6, 40));
    case 'triangle': return poly('50,14 88,86 12,86');
    case 'diamond': return poly('50,12 88,54 50,94 12,54');
    case 'clover': return `<path d="M50 20a14 14 0 0 1 26 10 14 14 0 0 1 10 26 14 14 0 0 1-26 10 14 14 0 0 1-26-10 14 14 0 0 1-10-26 14 14 0 0 1 26-10z" ${at} />`;
    case 'star': return poly(ring(10, 40, 50, 54, -90));
    case 'drop': return `<path d="M50 12c16 20 28 30 28 44a28 28 0 0 1-56 0c0-14 12-24 28-44z" ${at} />`;
    case 'pill': return `<rect x="18" y="20" width="64" height="68" rx="32" ${at} />`;
    case 'capsule': return `<rect x="24" y="14" width="52" height="80" rx="26" ${at} />`;
    case 'pebble': return `<path d="M24 42c0-14 12-22 26-22s26 10 26 24-6 30-16 36-30 4-34-8-2-16-2-30z" ${at} />`;
    case 'puddle': return `<path d="M14 62c0-18 16-30 36-30s36 12 36 28-14 30-36 30-36-10-36-28z" ${at} />`;
    case 'blob': return `<path d="M50 14c18 0 34 12 34 30 0 14-6 22-14 28s-14 12-26 12-34-10-34-30S32 14 50 14z" ${at} />`;
    case 'ghost': return `<path d="M18 52a32 32 0 0 1 64 0v34l-10-8-10 8-12-8-12 8-10-8-10 8z" ${at} />`;
    case 'cloud': return `<path d="M28 76a18 18 0 0 1-2-36 22 22 0 0 1 42-8 18 18 0 0 1 8 34 18 18 0 0 1-20 12z" ${at} />`;
    case 'shield': return `<path d="M50 12l34 12v28c0 20-16 32-34 38-18-6-34-18-34-38V24z" ${at} />`;
    case 'bell': return `<path d="M50 14a24 24 0 0 1 24 24v22l8 12H18l8-12V38a24 24 0 0 1 24-24z" ${at} />`;
    case 'gem': return poly('50,12 84,40 68,88 32,88 16,40');
    case 'trapezoid': return poly('28,18 72,18 88,88 12,88');
    case 'flower': return poly(ring(12, 40, 50, 54, -90));
    case 'cat': return poly('24,26 34,14 44,26 56,26 66,14 76,26 80,60 50,92 20,60');
    case 'droid': return `<rect x="16" y="24" width="68" height="60" rx="18" ${at} /><rect x="46" y="10" width="8" height="14" ${at} />`;
    case 'mech': return poly('18,26 34,20 50,26 66,20 82,26 82,70 50,90 18,70');
    case 'alien': return `<path d="M50 12c22 0 34 16 34 34 0 22-22 40-34 48-12-8-34-26-34-48 0-18 12-34 34-34z" ${at} />`;
    case 'leaf': return `<path d="M50 12c24 10 32 30 26 48s-24 26-26 30c-2-4-20-12-26-30S26 22 50 12z" ${at} />`;
    case 'kite': return poly('50,10 82,48 50,92 18,48');
    case 'gear': return poly(ring(8, 40, 50, 54, -90));
    case 'bolt': return poly('56,10 30,52 46,52 40,94 72,48 54,48');
    case 'notch': return `<path d="M18 20h64v30l-14 10 14 10v14H18V64l14-10-14-10z" ${at} />`;
    case 'wave': return `<path d="M14 62c0-20 12-34 36-34s36 14 36 32-10 34-30 34c-16 0-22-8-30-8s-12 6-12-24z" ${at} />`;
    default: return `<circle cx="50" cy="54" r="38" ${at} />`;
  }
}

export function avatarSvg(spec: AvatarSpec): string {
  const p = partsFor(spec);
  const fill = `hsl(${p.hue} 62% 66%)`;
  const stroke = `hsl(${p.hue} 45% 38%)`;
  const ink = p.hue > 40 && p.hue < 190 ? '#20222a' : '#1b1d24';
  const l = 50 - p.eyeGap;
  const r = 50 + p.eyeGap;
  const eye = (cx: number): string => `<ellipse cx="${cx}" cy="52" rx="${p.eyeSize}" ry="${p.eyeSize + 1}" fill="${ink}" />`;
  const mouth = p.face === 'mouth'
    ? `<path d="M40 66q10 8 20 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" />`
    : '';
  const blush = p.blush
    ? `<ellipse cx="30" cy="62" rx="6" ry="4" fill="hsl(${p.hue} 70% 55%)" opacity="0.45" /><ellipse cx="70" cy="62" rx="6" ry="4" fill="hsl(${p.hue} 70% 55%)" opacity="0.45" />`
    : '';
  const glasses = p.glasses === 'none' ? '' : p.glasses === 'shades'
    ? `<rect x="${l - 8}" y="46" width="16" height="12" rx="3" fill="${ink}" /><rect x="${r - 8}" y="46" width="16" height="12" rx="3" fill="${ink}" /><rect x="${l + 8}" y="50" width="${p.eyeGap * 2 - 16}" height="3" fill="${ink}" />`
    : `<circle cx="${l}" cy="52" r="9" fill="none" stroke="${ink}" stroke-width="2.5" /><circle cx="${r}" cy="52" r="9" fill="none" stroke="${ink}" stroke-width="2.5" />${p.glasses === 'square' ? `<rect x="${l - 9}" y="43" width="18" height="18" fill="none" stroke="${ink}" stroke-width="2.5" /><rect x="${r - 9}" y="43" width="18" height="18" fill="none" stroke="${ink}" stroke-width="2.5" />` : ''}`;
  const hat = p.hat === 'none' ? '' : p.hat === 'halo'
    ? `<ellipse cx="50" cy="18" rx="22" ry="6" fill="none" stroke="hsl(48 90% 60%)" stroke-width="4" />`
    : p.hat === 'horns'
    ? `<path d="M34 24q-6-14 4-18 6 8 6 16" fill="${stroke}" /><path d="M66 24q6-14-4-18-6 8-6 16" fill="${stroke}" />`
    : p.hat === 'party'
    ? `<path d="M50 4l14 26H36z" fill="hsl(${(p.hue + 140) % 360} 75% 62%)" stroke="${stroke}" stroke-width="1.5" />`
    : p.hat === 'crown'
    ? `<path d="M32 26l6-14 6 10 6-14 6 14 6-10 6 14z" fill="hsl(46 92% 62%)" stroke="${stroke}" stroke-width="1.5" />`
    : p.hat === 'beanie'
    ? `<path d="M20 34a30 22 0 0 1 60 0z" fill="hsl(${(p.hue + 30) % 360} 55% 45%)" /><rect x="20" y="32" width="60" height="8" rx="4" fill="hsl(${(p.hue + 30) % 360} 45% 38%)" />`
    : `<path d="M22 32q28-18 56 0-8-16-28-16T22 32z" fill="hsl(${(p.hue + 200) % 360} 55% 48%)" />`;
  const antenna = p.antenna === 'none' ? '' : p.antenna === 'stub'
    ? `<rect x="47" y="6" width="6" height="14" rx="3" fill="${stroke}" />`
    : p.antenna === 'loop'
    ? `<path d="M50 18q0-14 10-12q8 2 0 10" fill="none" stroke="${stroke}" stroke-width="3" />`
    : `<path d="M38 18q-4-12 6-12M62 18q4-12-6-12" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="${p.shape} agent avatar">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${p.hue} 70% 76%)" /><stop offset="1" stop-color="hsl(${p.hue} 55% 56%)" /></linearGradient></defs>
<ellipse cx="50" cy="92" rx="26" ry="4" fill="rgba(0,0,0,.16)" />
${antenna}${body(p.shape, 'url(#g)', stroke)}${blush}${eye(l)}${eye(r)}${glasses}${mouth}${hat}
</svg>`;
}
