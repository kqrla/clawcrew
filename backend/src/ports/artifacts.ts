import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * evidence points at a content hash, never at a url.
 * urls rot, pages change, and a bookmark that quotes a page is not the page.
 */
export interface ArtifactRef {
  hash: string;
  size: number;
  mediaType: string;
}

export interface ArtifactStore {
  put(bytes: Uint8Array, meta: { mediaType: string }): Promise<ArtifactRef>;
  get(hash: string): Promise<Uint8Array>;
  exists(hash: string): Promise<boolean>;
}

export function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function formatRef(hash: string): string {
  return `artifact://sha256:${hash}`;
}

export function parseRef(ref: string): string {
  const m = /^artifact:\/\/sha256:([0-9a-f]{64})$/.exec(ref);
  if (!m) throw new Error(`not a content-addressed artifact ref: ${ref}`);
  return m[1]!;
}

/**
 * the default store. local, boring, and enough to prove the loop before anyone
 * stands up minio. swap for s3 behind the same three methods.
 */
export function fsArtifactStore(root: string): ArtifactStore {
  const pathFor = (hash: string) => join(root, hash.slice(0, 2), hash.slice(2));
  const metaPath = (hash: string) => join(root, 'meta', `${hash}.json`);

  return {
    async put(bytes, meta) {
      const hash = hashBytes(bytes);
      const path = pathFor(hash);
      await mkdir(dirname(path), { recursive: true });
      await mkdir(join(root, 'meta'), { recursive: true });
      await writeFile(path, bytes);
      await writeFile(metaPath(hash), JSON.stringify({ mediaType: meta.mediaType, size: bytes.byteLength }));
      return { hash, size: bytes.byteLength, mediaType: meta.mediaType };
    },
    async get(hash) {
      return new Uint8Array(await readFile(pathFor(hash)));
    },
    async exists(hash) {
      try {
        await access(pathFor(hash));
        return true;
      } catch {
        return false;
      }
    },
  };
}
