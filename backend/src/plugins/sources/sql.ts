import { MetricReading, ObjectiveSourcePlugin, SourceContext } from '../types.js';

// a read-only guard. not a sandbox: the connection itself must also be read-only.
// the point is that a stray write fails here, loudly, before it reaches a surface.
const READ_ONLY = /^\s*(select|with)\b/i;
const MULTI = /;\s*\S/;
const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|grant|truncate|copy|vacuum)\b/i;

export function assertReadOnly(sql: string): void {
  if (!READ_ONLY.test(sql)) throw new Error('objective source must be a select or with query');
  if (MULTI.test(sql)) throw new Error('objective source must be a single statement');
  if (FORBIDDEN.test(sql)) throw new Error('objective source may not mutate state');
}

export function sqlSource(): ObjectiveSourcePlugin {
  return {
    id: 'sql',
    kind: 'objective_source',
    abi: '1',
    description: 'executes one read-only query and reads a single numeric column',
    schemes: ['sql'],
    async read(ref: string, ctx: SourceContext): Promise<MetricReading> {
      const sql = ref.replace(/^sql:/, '');
      assertReadOnly(sql);
      if (!ctx.runSql) throw new Error('sql source requires a runSql port');
      const rows = await ctx.runSql(sql);
      if (rows.length !== 1) throw new Error(`expected exactly one row, got ${rows.length}`);
      const row = rows[0]!;
      const values = Object.values(row);
      if (values.length !== 1) throw new Error('expected exactly one column');
      const raw = values[0];
      const value = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(value)) throw new Error('query result is not numeric');
      return { value, computedAt: ctx.now, provenance: 'sql' };
    },
  };
}
