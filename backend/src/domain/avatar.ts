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
  // plush, not outlined: the shape is a form under a light, and `stroke` only tints the
  // small hard parts (antennae, hat brims) where a real toy has a seam
  const at = 'fill="' + fill + '"';
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
  const fill = `url(#skin)`;
  const stroke = `hsl(${p.hue} 42% 34%)`;
  const ink = '#15171c';
  const l = 50 - p.eyeGap;
  const r = 50 + p.eyeGap;
  // a bead eye: dark lens, one hard specular dot, one soft one, so it reads as glossy
  const eye = (cx: number): string => `<g><ellipse cx="${cx}" cy="52" rx="${p.eyeSize}" ry="${p.eyeSize + 1.4}" fill="${ink}" /><ellipse cx="${cx - 1.2}" cy="49.4" rx="${(p.eyeSize / 3).toFixed(1)}" ry="${(p.eyeSize / 3).toFixed(1)}" fill="#fff" opacity=".92" /><ellipse cx="${cx + 1.4}" cy="55.4" rx="${(p.eyeSize / 4).toFixed(1)}" ry="${(p.eyeSize / 5).toFixed(1)}" fill="#fff" opacity=".35" /></g>`;
  const mouth = p.face === 'mouth'
    ? `<path d="M41 66q9 7 18 0" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" opacity=".85" />`
    : '';
  const blush = p.blush
    ? `<ellipse cx="31" cy="61" rx="7" ry="4.4" fill="hsl(${p.hue} 72% 58%)" opacity=".3" /><ellipse cx="69" cy="61" rx="7" ry="4.4" fill="hsl(${p.hue} 72% 58%)" opacity=".3" />`
    : '';
  const glasses = p.glasses === 'none' ? '' : p.glasses === 'shades'
    ? `<rect x="${l - 8}" y="46" width="16" height="11" rx="4" fill="${ink}" opacity=".9" /><rect x="${r - 8}" y="46" width="16" height="11" rx="4" fill="${ink}" opacity=".9" /><rect x="${l + 8}" y="50" width="${Math.max(2, p.eyeGap * 2 - 16)}" height="2.6" fill="${ink}" opacity=".9" />`
    : `<circle cx="${l}" cy="52" r="9.4" fill="none" stroke="${ink}" stroke-width="2.2" opacity=".8" /><circle cx="${r}" cy="52" r="9.4" fill="none" stroke="${ink}" stroke-width="2.2" opacity=".8" />${p.glasses === 'square' ? `<rect x="${l - 9}" y="43" width="18" height="18" rx="3" fill="none" stroke="${ink}" stroke-width="2.2" opacity=".8" /><rect x="${r - 9}" y="43" width="18" height="18" rx="3" fill="none" stroke="${ink}" stroke-width="2.2" opacity=".8" />` : ''}`;
  const hat = p.hat === 'none' ? '' : p.hat === 'halo'
    ? `<ellipse cx="50" cy="16" rx="21" ry="5.5" fill="none" stroke="hsl(48 92% 62%)" stroke-width="3.4" opacity=".95" />`
    : p.hat === 'horns'
    ? `<path d="M35 27q-7-15 3-19 6 8 7 15" fill="hsl(${(p.hue + 320) % 360} 45% 62%)" /><path d="M65 27q7-15-3-19-6 8-7 15" fill="hsl(${(p.hue + 320) % 360} 45% 62%)" />`
    : p.hat === 'party'
    ? `<path d="M50 6l13 24H37z" fill="hsl(${(p.hue + 150) % 360} 78% 64%)" /><circle cx="50" cy="6" r="3" fill="hsl(${(p.hue + 60) % 360} 85% 70%)" />`
    : p.hat === 'crown'
    ? `<path d="M33 27l6-13 5.5 9 5.5-13 5.5 13 5.5-9 6 13z" fill="hsl(46 92% 63%)" />`
    : p.hat === 'beanie'
    ? `<path d="M22 33a28 21 0 0 1 56 0z" fill="hsl(${(p.hue + 20) % 360} 58% 58%)" /><rect x="22" y="31" width="56" height="7" rx="3.5" fill="hsl(${(p.hue + 20) % 360} 44% 46%)" />`
    : `<path d="M23 33q27-17 54 0-9-15-27-15T23 33z" fill="hsl(${(p.hue + 210) % 360} 52% 52%)" />`;
  const antenna = p.antenna === 'none' ? '' : p.antenna === 'stub'
    ? `<rect x="47.5" y="7" width="5" height="13" rx="2.5" fill="${stroke}" />`
    : p.antenna === 'loop'
    ? `<path d="M50 19q0-15 10-13 9 2 0 11" fill="none" stroke="${stroke}" stroke-width="2.8" stroke-linecap="round" />`
    : `<path d="M39 19q-5-13 5-13M61 19q5-13-5-13" fill="none" stroke="${stroke}" stroke-width="2.8" stroke-linecap="round" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="${p.shape} agent avatar">
<defs>
  <linearGradient id="skin" x1="0.25" y1="0" x2="0.75" y2="1">
    <stop offset="0" stop-color="hsl(${p.hue} 74% 78%)" />
    <stop offset="0.55" stop-color="hsl(${p.hue} 62% 64%)" />
    <stop offset="1" stop-color="hsl(${p.hue} 52% 48%)" />
  </linearGradient>
  <radialGradient id="sheen" cx="0.34" cy="0.24" r="0.55">
    <stop offset="0" stop-color="#fff" stop-opacity=".55" />
    <stop offset="0.7" stop-color="#fff" stop-opacity="0" />
  </radialGradient>
  <radialGradient id="shade" cx="0.5" cy="0.5" r="0.62">
    <stop offset="0.62" stop-color="#000" stop-opacity="0" />
    <stop offset="1" stop-color="#000" stop-opacity=".28" />
  </radialGradient>
  <filter id="plush" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="${hash(p.shape + p.hue) % 90}" result="n" />
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
    <feGaussianBlur stdDeviation="0.35" />
  </filter>
</defs>
<style>@media (prefers-reduced-motion: no-preference){#face{animation:blink 5.2s infinite}@keyframes blink{0%,96%,100%{transform:scaleY(1)}98%{transform:scaleY(.12)}}}</style>
<ellipse cx="50" cy="93" rx="25" ry="3.6" fill="#000" opacity=".16" />
${antenna}
<g filter="url(#plush)">
  ${body(p.shape, fill, stroke)}
  ${body(p.shape, 'url(#sheen)', 'none')}
  ${body(p.shape, 'url(#shade)', 'none')}
</g>
<g id="face" style="transform-origin:50px 52px">
  ${blush}${eye(l)}${eye(r)}${glasses}${mouth}
</g>
${hat}
</svg>`;
}
