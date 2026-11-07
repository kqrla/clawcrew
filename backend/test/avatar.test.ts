import { describe, expect, it } from 'vitest';
import { avatarSvg, partsFor } from '../src/domain/avatar.js';

/** docs/50. generated avatars have to be stable, varied, and overridable one part at a time. */
describe('agent avatars', () => {
  it('gives a seat the same face every time it is asked', () => {
    expect(partsFor({ seed: 'seat.support' })).toEqual(partsFor({ seed: 'seat.support' }));
    expect(avatarSvg({ seed: 'seat.support' })).toBe(avatarSvg({ seed: 'seat.support' }));
  });

  it('gives different seats different faces', () => {
    expect(partsFor({ seed: 'a' }).shape === partsFor({ seed: 'b' }).shape
      && partsFor({ seed: 'a' }).hue === partsFor({ seed: 'b' }).hue).toBe(false);
  });

  it('spreads across many shapes, which is the point of a bigger set', () => {
    const shapes = new Set<string>();
    for (let i = 0; i < 400; i += 1) shapes.add(partsFor({ seed: `seat.${i}` }).shape);
    expect(shapes.size).toBeGreaterThan(24);
  });

  it('lets a person override one part and keeps the rest', () => {
    const auto = partsFor({ seed: 'seat.code' });
    const pinned = partsFor({ seed: 'seat.code', hat: 'crown', hue: 210 });
    expect(pinned.hat).toBe('crown');
    expect(pinned.hue).toBe(210);
    // everything not pinned still comes from the seed, so an override is one part
    expect(pinned.shape).toBe(auto.shape);
    expect(pinned.eyeGap).toBe(auto.eyeGap);
  });

  it('renders valid standalone svg', () => {
    const svg = avatarSvg({ seed: 'wing.audit' });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain('role="img"');
  });
});
