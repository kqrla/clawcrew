/**
 * docs/43. the other half of supervision: a stale heartbeat is the page.
 *
 *   npx tsx scripts/health.ts --max-age-ms 900000
 */
import { cell } from '../src/store/sql-cli.js';

const idx = process.argv.indexOf('--max-age-ms');
const maxAgeMs = idx === -1 ? 900_000 : Number(process.argv[idx + 1]);

const raw = cell(
  `coalesce((select state || '|' || floor(extract(epoch from (now() - at)) * 1000)::text || '|' || cycles from runner_heartbeat where id = 'support-loop'), 'none|0|0')`,
);
const [state, ageMs, cycles] = raw.split('|');
const age = Number(ageMs ?? 0);
const stale = state === 'none' || (state === 'running' && age > maxAgeMs);

console.log(`state=${state} age=${Math.round(age / 1000)}s cycles=${cycles} stale=${stale}`);
if (stale) {
  console.error(state === 'none' ? 'no runner has ever written a heartbeat' : `no heartbeat for ${Math.round(age / 1000)}s`);
  process.exitCode = 3;
}
