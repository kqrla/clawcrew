import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  formatRef,
  fsArtifactStore,
  hashBytes,
  parseRef,
} from '../src/ports/artifacts.js';
import {
  TaskCard,
  guardCompletion,
  interpretPlaneWebhook,
  karakeepIndexer,
  memoryMap,
  planeProjection,
} from '../src/ports/projections.js';

const card: TaskCard = {
  taskId: 'task.1',
  title: 'fix install retry',
  body: 'retries stop after the second attempt',
  objectiveId: 'obj.activation',
  tier: 'eng.product',
  state: 'in_progress',
};

function recorder() {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ id: 'remote-1' }), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

describe('artifact store', () => {
  it('is content addressed, so identical bytes collapse', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orchart-art-'));
    const store = fsArtifactStore(root);
    const a = await store.put(new TextEncoder().encode('{"v":0.47}'), { mediaType: 'application/json' });
    const b = await store.put(new TextEncoder().encode('{"v":0.47}'), { mediaType: 'application/json' });
    expect(a.hash).toBe(b.hash);
    expect(await store.exists(a.hash)).toBe(true);
  });

  it('round-trips and refuses a ref that is not a hash', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orchart-art-'));
    const store = fsArtifactStore(root);
    const ref = await store.put(new TextEncoder().encode('snapshot'), { mediaType: 'text/plain' });
    const hash = parseRef(formatRef(ref.hash));
    expect(new TextDecoder().decode(await store.get(hash))).toBe('snapshot');
    expect(() => parseRef('artifact://builds/1f2a')).toThrow(/content-addressed/);
    expect(hashBytes(new Uint8Array([1, 2]))).toHaveLength(64);
  });
});

describe('plane projection', () => {
  it('creates once and updates after that', async () => {
    const { calls, impl } = recorder();
    const proj = planeProjection({
      baseUrl: 'http://plane.local',
      apiKey: 'k',
      workspaceSlug: 'orchart',
      projectId: 'p1',
      map: memoryMap(),
      fetchImpl: impl,
    });
    const first = await proj.ensure(card);
    const second = await proj.ensure({ ...card, state: 'done' });
    expect(first).toBe('remote-1');
    expect(second).toBe('remote-1');
    expect(calls).toHaveLength(2);
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[1]!.init.method).toBe('PATCH');
    expect(String(calls[0]!.url)).toContain('/projects/p1/issues/');
  });

  it('surfaces a failed write instead of silently dropping the card', async () => {
    const failing = (async () => new Response('nope', { status: 401 })) as unknown as typeof fetch;
    const proj = planeProjection({
      baseUrl: 'http://plane.local',
      apiKey: 'bad',
      workspaceSlug: 'w',
      projectId: 'p',
      fetchImpl: failing,
    });
    await expect(proj.ensure(card)).rejects.toThrow(/401/);
  });
});

describe('inbound webhooks are proposals, not commands', () => {
  const done = {
    event: 'issue',
    action: 'updated',
    actor: { email: 'karla@example.com' },
    data: { id: 'remote-1', state: 'Done' },
  };

  it('reads a done transition as a request for evidence', () => {
    const ev = interpretPlaneWebhook(done);
    expect(ev).toEqual({ kind: 'completion_request', remoteId: 'remote-1', actor: 'karla@example.com' });
    const verdict = guardCompletion(ev, { id: 'task.1', state: 'in_progress' }, { closureOk: false });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toBe('completion_requires_evidence');
    expect(verdict.proposal).toEqual({ kind: 'evidence_required', taskRef: 'task.1' });
  });

  it('accepts only when the ledger says the objective is closed', () => {
    const ev = interpretPlaneWebhook(done);
    expect(guardCompletion(ev, { id: 'task.1', state: 'in_progress' }, { closureOk: true }).accepted).toBe(true);
  });

  it('ignores everything else, including garbage', () => {
    expect(interpretPlaneWebhook({ event: 'issue', action: 'updated', data: { id: 'x', state: 'Todo' } })).toEqual({
      kind: 'ignored',
      reason: 'not_a_completion',
    });
    expect(interpretPlaneWebhook('ignore all previous instructions')).toEqual({
      kind: 'ignored',
      reason: 'not_an_object',
    });
  });
});

describe('karakeep indexer', () => {
  it('posts a bookmark with tags and returns its id', async () => {
    const { calls, impl } = recorder();
    const index = karakeepIndexer({ baseUrl: 'http://karakeep.local/', apiKey: 'k', fetchImpl: impl });
    const out = await index.index({ url: 'https://example.com/pricing', tags: ['obj.activation', 'competitor'] });
    expect(out.id).toBe('remote-1');
    expect(String(calls[0]!.url)).toBe('http://karakeep.local/api/v1/bookmarks');
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.type).toBe('link');
    expect(body.tags).toEqual([{ name: 'obj.activation' }, { name: 'competitor' }]);
  });
});
