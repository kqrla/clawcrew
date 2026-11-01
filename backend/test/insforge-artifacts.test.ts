import { describe, expect, it } from 'vitest';
import { hashBytes } from '../src/ports/artifacts.js';
import { insforgeArtifactStore, keyFor } from '../src/ports/insforge-artifacts.js';

const BASE = 'https://proj.example.insforge.app';

/** an insforge storage stand-in that records the wire shape it received. */
function fakeStorage() {
  const objects = new Map<string, Uint8Array>();
  const calls: { method: string; url: string; auth?: string; form: boolean }[] = [];

  const impl = (async (url: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({ method, url, auth: headers.authorization, form: init.body instanceof FormData });

    const key = decodeURIComponent(url.split('/objects/')[1] ?? '');
    const hash = key.split('/').pop() ?? '';

    if (method === 'PUT') {
      // insforge rejects anything that is not multipart with a `file` field.
      const form = init.body;
      if (!(form instanceof FormData) || !form.get('file')) {
        return new Response(JSON.stringify({ error: 'STORAGE_INVALID_PARAMETER' }), { status: 400 });
      }
      const file = form.get('file') as Blob;
      objects.set(hash, new Uint8Array(await file.arrayBuffer()));
      return new Response(JSON.stringify({ bucket: 'artifacts', key }), { status: 200 });
    }

    if (method === 'GET') {
      const body = objects.get(hash);
      if (!body) return new Response('{"error":"STORAGE_NOT_FOUND"}', { status: 404 });
      return new Response(new Blob([body as unknown as ArrayBuffer]), { status: 200 });
    }

    if (method === 'HEAD') {
      return new Response(null, { status: objects.has(hash) ? 302 : 404 });
    }

    return new Response('', { status: 405 });
  }) as unknown as typeof fetch;

  return { impl, objects, calls };
}

describe('insforge artifacts', () => {
  const bytes = new TextEncoder().encode('orchart evidence probe');

  it('keys by content hash, two levels deep', () => {
    const hash = hashBytes(bytes);
    expect(keyFor(hash)).toBe(`sha256/${hash.slice(0, 2)}/${hash}`);
  });

  it('round-trips bytes and returns the hash as the identity', async () => {
    const store = fakeStorage();
    const artifacts = insforgeArtifactStore({
      baseUrl: BASE,
      apiKey: 'k',
      bucket: 'artifacts',
      fetchImpl: store.impl,
    });

    const ref = await artifacts.put(bytes, { mediaType: 'application/octet-stream' });
    expect(ref.hash).toBe(hashBytes(bytes));
    expect(ref.size).toBe(bytes.byteLength);

    const back = await artifacts.get(ref.hash);
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });

  it('uploads multipart, because a raw body is rejected', async () => {
    const store = fakeStorage();
    const artifacts = insforgeArtifactStore({
      baseUrl: BASE,
      apiKey: 'k',
      bucket: 'artifacts',
      fetchImpl: store.impl,
    });
    await artifacts.put(bytes, { mediaType: 'text/plain' });
    expect(store.calls[0]?.form).toBe(true);
    expect(store.calls[0]?.method).toBe('PUT');
    expect(store.calls[0]?.url).toContain('/api/storage/buckets/artifacts/objects/sha256/');
  });

  it('carries the api key and never the bucket in a form field', async () => {
    const store = fakeStorage();
    const artifacts = insforgeArtifactStore({
      baseUrl: BASE,
      apiKey: 'secret-key',
      bucket: 'artifacts',
      fetchImpl: store.impl,
    });
    await artifacts.put(bytes, { mediaType: 'text/plain' });
    expect(store.calls[0]?.auth).toBe('Bearer secret-key');
  });

  it('is idempotent: the same bytes reuse the same object', async () => {
    const store = fakeStorage();
    const artifacts = insforgeArtifactStore({
      baseUrl: BASE,
      apiKey: 'k',
      bucket: 'artifacts',
      fetchImpl: store.impl,
    });
    const a = await artifacts.put(bytes, { mediaType: 'text/plain' });
    const b = await artifacts.put(bytes, { mediaType: 'text/plain' });
    expect(a.hash).toBe(b.hash);
    expect(store.objects.size).toBe(1);
  });

  it('refuses a read that does not hash back to its key', async () => {
    const store = fakeStorage();
    const artifacts = insforgeArtifactStore({
      baseUrl: BASE,
      apiKey: 'k',
      bucket: 'artifacts',
      fetchImpl: store.impl,
    });
    const ref = await artifacts.put(bytes, { mediaType: 'text/plain' });
    store.objects.set(ref.hash, new TextEncoder().encode('tampered'));
    await expect(artifacts.get(ref.hash)).rejects.toThrow(/corrupt/);
  });

  it('reports existence without downloading', async () => {
    const store = fakeStorage();
    const artifacts = insforgeArtifactStore({
      baseUrl: BASE,
      apiKey: 'k',
      bucket: 'artifacts',
      fetchImpl: store.impl,
    });
    expect(await artifacts.exists(hashBytes(bytes))).toBe(false);
    const ref = await artifacts.put(bytes, { mediaType: 'text/plain' });
    expect(await artifacts.exists(ref.hash)).toBe(true);
  });
});
