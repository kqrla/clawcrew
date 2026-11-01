import { ArtifactRef, ArtifactStore, hashBytes } from './artifacts.js';

/**
 * artifacts on insforge storage.
 *
 * the build has exactly one backend, so evidence blobs live where the record
 * lives. content addressing is what makes that safe: the key is the hash, so a
 * retry overwrites with identical bytes instead of appending a duplicate, and a
 * read that does not hash back to its key is corruption rather than a new version.
 *
 * two wire facts, both learned the hard way:
 *   - upload is multipart form-data with a field named `file`, not a raw body
 *   - download answers 302 to a signed url, so the fetch must follow redirects
 */
export interface InsForgeArtifactOptions {
  baseUrl: string;
  apiKey: string;
  bucket: string;
  fetchImpl?: typeof fetch;
}

export function keyFor(hash: string): string {
  return `sha256/${hash.slice(0, 2)}/${hash}`;
}

export function insforgeArtifactStore(opts: InsForgeArtifactOptions): ArtifactStore {
  const base = opts.baseUrl.replace(/\/$/, '');
  const doFetch = opts.fetchImpl ?? fetch;
  const url = (hash: string) =>
    `${base}/api/storage/buckets/${encodeURIComponent(opts.bucket)}/objects/${keyFor(hash)}`;

  return {
    async put(bytes, meta) {
      const hash = hashBytes(bytes);
      const form = new FormData();
      form.append(
        'file',
        new Blob([bytes as unknown as ArrayBuffer], { type: meta.mediaType }),
        hash,
      );

      const res = await doFetch( url(hash), {
        method: 'PUT',
        headers: { authorization: `Bearer ${opts.apiKey}` },
        body: form,
      });
      if (!res.ok) {
        throw new Error(`artifact put failed: ${res.status} ${await safeBody(res)}`);
      }
      return { hash, size: bytes.byteLength, mediaType: meta.mediaType };
    },

    async get(hash) {
      const res = await doFetch( url(hash), {
        headers: { authorization: `Bearer ${opts.apiKey}` },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`artifact get failed: ${res.status} ${hash}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const got = hashBytes(bytes);
      if (got !== hash) throw new Error(`artifact corrupt: expected ${hash}, got ${got}`);
      return bytes;
    },

    async exists(hash) {
      const res = await doFetch( url(hash), {
        method: 'HEAD',
        headers: { authorization: `Bearer ${opts.apiKey}` },
        redirect: 'manual',
      });
      return res.status >= 200 && res.status < 400;
    },
  };
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '<no body>';
  }
}
