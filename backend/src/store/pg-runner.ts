/**
 * docs/45. self-hosting should not require a system package. the sandbox image has no
 * psql and no root to install one, and neither does a stock runtime image, so the
 * self-hosted driver is node-postgres in a one-shot child: synchronous like the domain,
 * and needing nothing on the box but node.
 */
import { execFileSync } from 'node:child_process';
import type { Runner } from './sql-cli.js';

const ONE_SHOT = `
const { Client } = require('pg');
const sql = process.argv[1];
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    const r = await c.query(sql);
    for (const row of r.rows ?? []) process.stdout.write(Object.values(row).join('\\n') + '\\n');
  } catch (e) {
    process.stderr.write(String(e && e.message ? e.message : e) + '\\n');
    process.exit(1);
  } finally { await c.end().catch(() => {}); }
})();
`;

export const pgRunner: Runner = {
  name: 'node-pg',
  run(statement) {
    return execFileSync(process.execPath, ['-e', ONE_SHOT, statement], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
      env: process.env,
    });
  },
};
