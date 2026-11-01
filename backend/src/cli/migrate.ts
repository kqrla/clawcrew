import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

/**
 * a migration is applied once, and its checksum is recorded. editing a file that
 * already ran is a hard error rather than a silent no-op, because a record that
 * cannot say which version of the schema it holds is not a record.
 */

const dir = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL('../../migrations/', import.meta.url));

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: url,
    ssl: process.env.PG_NO_SSL === '1' ? undefined : { rejectUnauthorized: false },
    max: 1,
  });

  const client = await pool.connect();
  try {
    await client.query(`
      create table if not exists schema_migrations (
        id         text primary key,
        checksum   text not null,
        applied_at timestamptz not null default now()
      )`);

    const applied = new Map<string, string>();
    const { rows } = await client.query<{ id: string; checksum: string }>(
      'select id, checksum from schema_migrations',
    );
    for (const r of rows) applied.set(r.id, r.checksum);

    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    let ran = 0;

    for (const file of files) {
      const sql = await readFile(`${dir}/${file}`, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16);
      const prior = applied.get(file);

      if (prior === checksum) {
        console.log(`skip   ${file}`);
        continue;
      }
      if (prior && prior !== checksum) {
        console.error(`drift  ${file}: applied ${prior}, file is ${checksum}. write a new migration.`);
        process.exit(1);
      }

      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (id, checksum) values ($1, $2)', [file, checksum]);
        await client.query('commit');
        console.log(`apply  ${file}`);
        ran += 1;
      } catch (err) {
        await client.query('rollback');
        console.error(`fail   ${file}: ${(err as Error).message}`);
        process.exit(1);
      }
    }

    console.log(`done   ${ran} applied, ${files.length - ran} already current`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
