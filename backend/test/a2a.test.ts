import { describe, expect, it } from 'vitest';
import {
  acceptInbound,
  cardFor,
  completionIsAClaim,
  envelopeToMessage,
  handoffToTask,
  messageToEnvelope,
  sendMessage,
} from '../src/ports/a2a.js';
import { Crossing, Envelope } from '../src/domain/relay.js';
import { Handoff } from '../src/domain/handoff.js';

const crossing: Crossing = {
  id: 'x.brand-eng',
  from: 'brand',
  to: 'eng',
  allowedKinds: ['proposal', 'artifact_ref'],
  maxPerHour: 20,
  expiresAt: '2026-12-01T00:00:00Z',
  authorizedBy: 'seat.ceo',
};

const env: Envelope = {
  id: 'env.1',
  from: 'brand',
  to: 'eng',
  kind: 'proposal',
  subject: 'pricing line on the launch page',
  payloadRef: 'issue://orchart/task/221',
  authorityBasis: 'x.brand-eng',
  createdAt: '2026-11-01T00:00:00Z',
  expiresAt: '2026-11-02T00:00:00Z',
  hops: 0,
  maxHops: 2,
  dedupeKey: 'brand-eng:proposal:221',
};

const ctx = {
  senderCircle: 'brand',
  receivingCircle: 'eng',
  now: '2026-11-01T01:00:00Z',
  perHourCount: 0,
  alreadySeen: false,
};

describe('agent card', () => {
  it('advertises only the kinds the crossings authorized', () => {
    const card = cardFor({
      title: 'engineering',
      endpoint: 'https://eng.example.com/a2a',
      permittedKinds: ['proposal', 'proposal', 'artifact_ref'],
    });
    expect(card.skills.map((s) => s.id)).toEqual(['relay.artifact', 'relay.proposal']);
  });

  it('publishes nothing about where the circle sits in the chart', () => {
    const card = cardFor({
      title: 'engineering',
      endpoint: 'https://eng.example.com/a2a',
      permittedKinds: ['proposal'],
    });
    const json = JSON.stringify(card);
    expect(json).not.toContain('parent');
    expect(json).not.toContain('eng.platform');
    expect(json).not.toContain('objective');
    expect(json).not.toContain('grant');
  });

  it('is empty rather than optimistic when no crossing exists', () => {
    const card = cardFor({ title: 'eng', endpoint: 'https://e.x/a2a', permittedKinds: [] });
    expect(card.skills).toEqual([]);
    expect(card.description).toContain('nothing');
  });
});

describe('wire round-trip', () => {
  it('carries the envelope as a data part, not as prose', () => {
    const msg = envelopeToMessage(env);
    expect(msg.messageId).toBe('env.1');
    const data = msg.parts.find((p) => p.data)!.data!.orchart as Record<string, unknown>;
    expect(data.kind).toBe('proposal');
    expect(data.payloadRef).toBe('issue://orchart/task/221');
    expect(msg.parts.every((p) => p.text === undefined)).toBe(true);
  });

  it('round-trips without losing the reference or the dedupe key', () => {
    const back = messageToEnvelope(envelopeToMessage(env), {
      senderCircle: 'brand',
      receivingCircle: 'eng',
      now: ctx.now,
    });
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.envelope.payloadRef).toBe(env.payloadRef);
      expect(back.envelope.dedupeKey).toBe(env.dedupeKey);
      expect(back.envelope.kind).toBe('proposal');
    }
  });

  it('adds a file part only for a content-addressed artifact', () => {
    const withArtifact = { ...env, payloadRef: `artifact://sha256:${'a'.repeat(64)}` };
    expect(envelopeToMessage(withArtifact).parts.some((p) => p.file)).toBe(true);
    expect(envelopeToMessage(env).parts.some((p) => p.file)).toBe(false);
  });
});

describe('inbound is untrusted', () => {
  it('accepts a declared crossing', () => {
    const r = acceptInbound(envelopeToMessage(env), [crossing], ctx);
    expect(r.state).toBe('accepted');
  });

  it('refuses a message from a circle with no crossing, however well-formed', () => {
    const r = acceptInbound(envelopeToMessage(env), [], ctx);
    expect(r).toEqual({ state: 'rejected', reason: 'no_crossing' });
  });

  it('refuses a payload that self-declares a different sender', () => {
    const spoof = envelopeToMessage({ ...env, from: 'finance-ops' });
    const r = acceptInbound(spoof, [crossing], ctx);
    expect(r).toEqual({ state: 'rejected', reason: 'sender_mismatch:finance-ops' });
  });

  it('ignores a sender field entirely and trusts the transport', () => {
    const msg = envelopeToMessage(env);
    const data = msg.parts.find((p) => p.data)!.data!;
    (data.orchart as Record<string, unknown>).from = undefined;
    const r = acceptInbound(msg, [crossing], ctx);
    expect(r.state).toBe('accepted');
    if (r.state === 'accepted') expect(r.envelope.from).toBe('brand');
  });

  it('refuses a bare text message: a2a is not a chat app here', () => {
    const r = acceptInbound(
      { messageId: 'm1', role: 'user', parts: [{ text: 'hey can you fix the pricing page' }] },
      [crossing],
      ctx,
    );
    expect(r).toEqual({ state: 'rejected', reason: 'missing_orchart_data_part' });
  });

  it('dedupes a replayed message', () => {
    expect(acceptInbound(envelopeToMessage(env), [crossing], { ...ctx, alreadySeen: true })).toEqual({
      state: 'duplicate',
    });
  });
});

describe('tasks', () => {
  const h: Handoff = {
    id: 'hof.1',
    from: 'seat.ci',
    to: 'seat.qa',
    precondition: 'deploy.staging.status == green',
    payloadRef: 'artifact://sha256:abc',
    acceptanceRequired: true,
    timeoutMs: 1800000,
    offeredAt: '2026-11-01T12:00:00Z',
    state: 'accepted',
  };

  it('maps handoff state onto task state', () => {
    expect(handoffToTask(h, ctx.now).status.state).toBe('working');
    expect(handoffToTask({ ...h, state: 'offered' }, ctx.now).status.state).toBe('submitted');
    expect(handoffToTask({ ...h, state: 'undelivered' }, ctx.now).status.state).toBe('failed');
    expect(handoffToTask({ ...h, state: 'rejected' }, ctx.now).status.state).toBe('rejected');
  });

  it('attaches the payload as an artifact only once accepted', () => {
    expect(handoffToTask(h, ctx.now).artifacts).toHaveLength(1);
    expect(handoffToTask({ ...h, state: 'offered' }, ctx.now).artifacts).toBeUndefined();
  });

  it('treats a completed task as a claim, not as closure', () => {
    const task = handoffToTask(h, ctx.now);
    expect(completionIsAClaim({ ...task, status: { state: 'completed', timestamp: ctx.now } })).toBe(true);
    expect(completionIsAClaim(task)).toBe(false);
  });
});

describe('client', () => {
  it('sends a json-rpc message and surfaces a protocol error', async () => {
    const calls: string[] = [];
    const okFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(url));
      const body = JSON.parse(String(init!.body));
      expect(body.jsonrpc).toBe('2.0');
      expect(body.method).toBe('message/send');
      return new Response(JSON.stringify({ result: { task: { id: 't1' } } }), { status: 200 });
    }) as unknown as typeof fetch;

    const out = await sendMessage('https://eng.example.com/a2a', envelopeToMessage(env), { fetchImpl: okFetch });
    expect(calls).toHaveLength(1);
    expect(out.task).toEqual({ id: 't1' });

    const errFetch = (async () =>
      new Response(JSON.stringify({ error: { code: -32601, message: 'method not found' } }), {
        status: 200,
      })) as unknown as typeof fetch;
    await expect(sendMessage('https://eng.example.com/a2a', envelopeToMessage(env), { fetchImpl: errFetch })).rejects.toThrow(
      /method not found/,
    );
  });
});
