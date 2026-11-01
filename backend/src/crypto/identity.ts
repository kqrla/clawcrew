/**
 * who said this. docs/27 §9b: paperclip already decided the shape, and it is
 * the shape every signed-message system converges on, so there is nothing to
 * invent: Ed25519, a key id that is a fingerprint of the public key, and a
 * signature over a canonical encoding of the thing being signed.
 *
 * the point is not cryptography as ceremony. it is that a claim arriving from
 * another sandbox carries its own verification: the receiving tier checks a
 * signature instead of deciding whether to trust a tier path it cannot see.
 * authority comes from a key, not from prose, which is the first standing rule.
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';

export const ALGORITHM = 'Ed25519' as const;

export interface AgentIdentity {
  algorithm: typeof ALGORITHM;
  /** fingerprint of the public key. safe to publish, and the identity in a dispute */
  keyId: string;
  publicKeyPem: string;
  /** never leaves the sandbox that holds it, and never lands in a log */
  privateKeyPem: string;
}

/**
 * canonical json: keys sorted, no insignificant whitespace. two processes must
 * produce the same bytes for the same card or every signature looks forged.
 */
export function canonical(value: unknown): string {
  const walk = (v: unknown): string => {
    if (v === null) return 'null';
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new Error('cannot sign a non-finite number');
      return JSON.stringify(v);
    }
    if (typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(walk).join(',')}]`;
    if (typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>)
        .filter(([, val]) => val !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return `{${entries.map(([k, val]) => `${JSON.stringify(k)}:${walk(val)}`).join(',')}}`;
    }
    throw new Error(`cannot canonicalise ${typeof v}`);
  };
  return walk(value);
}

const spki = (publicKeyPem: string): Buffer =>
  createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });

/** the key id is derived from the key, so it cannot be assigned by hand. */
export function keyIdFor(publicKeyPem: string): string {
  return createHash('sha256').update(spki(publicKeyPem)).digest('hex');
}

export function generateIdentity(): AgentIdentity {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return { algorithm: ALGORITHM, keyId: keyIdFor(publicKeyPem), publicKeyPem, privateKeyPem };
}

export interface SignedCard {
  card: Record<string, unknown>;
  /** the hash is over the card alone, so a card can be identified without a key */
  cardHash: string;
  keyId: string;
  algorithm: string;
  signature: string;
}

export function cardHash(card: Record<string, unknown>): string {
  return createHash('sha256').update(canonical(card)).digest('hex');
}

export function signCard(card: Record<string, unknown>, identity: AgentIdentity): SignedCard {
  const bytes = Buffer.from(canonical(card), 'utf8');
  const signature = sign(null, bytes, createPrivateKey(identity.privateKeyPem)).toString('base64');
  return {
    card,
    cardHash: cardHash(card),
    keyId: identity.keyId,
    algorithm: ALGORITHM,
    signature,
  };
}

export type VerifyVerdict = { ok: true } | { ok: false; reason: string };

/**
 * verification is over the bytes that arrive, not over the card object after a
 * parser has been at it. a signature that verifies only after re-encoding is a
 * signature over something nobody sent.
 */
export function verifyCard(signed: SignedCard, publicKeyPem: string): VerifyVerdict {
  if (signed.algorithm !== ALGORITHM) return { ok: false, reason: 'algorithm_mismatch' };
  if (keyIdFor(publicKeyPem) !== signed.keyId) return { ok: false, reason: 'key_id_mismatch' };
  if (cardHash(signed.card) !== signed.cardHash) return { ok: false, reason: 'card_hash_mismatch' };

  const ok = verify(
    null,
    Buffer.from(canonical(signed.card), 'utf8'),
    createPublicKey(publicKeyPem),
    Buffer.from(signed.signature, 'base64'),
  );
  return ok ? { ok: true } : { ok: false, reason: 'signature_invalid' };
}
