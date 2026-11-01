import { readFileSync } from 'node:fs';
import { insforgeArtifactStore } from '../ports/insforge-artifacts.js';

/**
 * live probe against the real bucket. not part of the test suite, because it
 * needs a network and a key; run it with:
 *   node --import tsx src/cli/verify-artifacts.ts
 */
async function main(): Promise<void> {
  const cfg = JSON.parse(
    readFileSync(new URL('../../.insforge/project.json', import.meta.url), 'utf8'),
  ) as { oss_host: string; api_key: string };

  const store = insforgeArtifactStore({
    baseUrl: cfg.oss_host,
    apiKey: cfg.api_key,
    bucket: 'artifacts',
  });

  const payload = new TextEncoder().encode(`orchart probe ${new Date().toISOString()}`);
  const ref = await store.put(payload, { mediaType: 'text/plain' });
  console.log('put      ', ref.hash.slice(0, 16), ref.size, 'bytes');

  const back = await store.get(ref.hash);
  const same = Buffer.compare(Buffer.from(back), Buffer.from(payload)) === 0;
  console.log('get      ', same ? 'bytes match' : 'MISMATCH');

  console.log('exists   ', await store.exists(ref.hash));

  const again = await store.put(payload, { mediaType: 'text/plain' });
  console.log('idempotent', again.hash === ref.hash ? 'same key' : 'NEW KEY');

  if (!same || again.hash !== ref.hash) process.exit(1);
  console.log('insforge artifacts verified');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
