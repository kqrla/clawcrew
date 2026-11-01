import { describe, expect, it } from 'vitest';
import {
  canonical,
  generateIdentity,
  keyIdFor,
  signCard,
  verifyCard,
} from '../src/crypto/identity.js';

/**
 * docs/27 §9b. a card from another sandbox carries its own verification, so a
 * receiving tier checks a signature instead of deciding whether to trust a tier
 * path it cannot see.
 */
const CARD = {
  subject: 't.product.pod.a',
  objective: 'obj.retention.v2',
  metrics: { retention: 41.2, sampleSize: 1_204 },
  issuedAt: '2026-11-01T12:00:00.000Z',
};

describe('canonical encoding', () => {
  it('is the same bytes whatever order the keys arrived in', () => {
    expect(canonical({ b: 1, a: 2 })).toBe(canonical({ a: 2, b: 1 }));
    expect(canonical({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('nests deterministically', () => {
    expect(canonical({ x: [{ d: 1, c: 2 }] })).toBe('{"x":[{"c":2,"d":1}]}');
  });

  it('drops undefined but keeps null, because they mean different things', () => {
    expect(canonical({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it('refuses to sign a number json cannot represent', () => {
    expect(() => canonical({ a: Number.NaN })).toThrow();
    expect(() => canonical({ a: Infinity })).toThrow();
  });
});

describe('identity', () => {
  it('derives the key id from the key, so it cannot be assigned by hand', () => {
    const a = generateIdentity();
    expect(a.keyId).toBe(keyIdFor(a.publicKeyPem));
    expect(a.keyId).toHaveLength(64);
    expect(generateIdentity().keyId).not.toBe(a.keyId);
  });
});

describe('signed cards', () => {
  const identity = generateIdentity();

  it('verifies against the public key it was signed with', () => {
    expect(verifyCard(signCard(CARD, identity), identity.publicKeyPem)).toEqual({ ok: true });
  });

  it('fails when the card was altered after signing', () => {
    const signed = signCard(CARD, identity);
    const tampered = { ...signed, card: { ...CARD, metrics: { retention: 99, sampleSize: 1_204 } } };
    expect(verifyCard(tampered, identity.publicKeyPem)).toEqual({
      ok: false,
      reason: 'card_hash_mismatch',
    });
  });

  it('fails when the hash was recomputed to match the tampering', () => {
    const signed = signCard(CARD, identity);
    const tampered = { ...signed, card: { ...CARD, subject: 't.product.pod.b' } };
    tampered.cardHash = signed.cardHash; // still the old card's hash
    expect(verifyCard(tampered, identity.publicKeyPem)).toEqual({
      ok: false,
      reason: 'card_hash_mismatch',
    });
  });

  it('fails when it is presented as a different key', () => {
    const other = generateIdentity();
    expect(verifyCard(signCard(CARD, identity), other.publicKeyPem)).toEqual({
      ok: false,
      reason: 'key_id_mismatch',
    });
  });

  it('fails when the signature is a valid one over something else', () => {
    const signed = signCard(CARD, identity);
    const otherSig = signCard({ ...CARD, subject: 'somebody else' }, identity);
    // the card hash is recomputed to match, so only the signature is left to fail
    const rehashed = { ...signed, card: otherSig.card, cardHash: otherSig.cardHash, signature: signed.signature };
    expect(verifyCard(rehashed, identity.publicKeyPem)).toEqual({
      ok: false,
      reason: 'signature_invalid',
    });
  });

  it('refuses a card that claims a different algorithm', () => {
    const signed = { ...signCard(CARD, identity), algorithm: 'RSA-SHA256' };
    expect(verifyCard(signed, identity.publicKeyPem)).toEqual({
      ok: false,
      reason: 'algorithm_mismatch',
    });
  });
});
