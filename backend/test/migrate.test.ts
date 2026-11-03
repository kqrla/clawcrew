import { describe, expect, it } from 'vitest';
import { objectNames, statements } from '../scripts/migrate.js';

/**
 * docs/40. the runner's job is to refuse, so the parts a test can hold are the parts
 * that decide what a file means: where its statements begin and end, and what it
 * claims to create.
 */
describe('reading a migration', () => {
  it('splits on statement ends, not on semicolons inside a line', () => {
    const sql = "create table a (id int);\ninsert into a values (1);\n";
    expect(statements(sql)).toHaveLength(2);
  });

  it('drops comment lines so a commented-out statement cannot run', () => {
    const sql = "-- drop table a;\ncreate table a (id int);\n";
    expect(statements(sql)).toEqual(['create table a (id int)']);
  });

  it('sends a dollar-quoted body as one batch, because it cannot be split safely', () => {
    const sql = 'do $$ begin\n  raise notice \'a;b\';\nend $$;\ncreate table a (id int);\n';
    expect(statements(sql)).toHaveLength(1);
  });

  it('knows what a file claims to create, in a stable order', () => {
    const sql = [
      'create table if not exists beta (id int);',
      'create or replace view alpha as select 1;',
      'create index on beta (id);',
    ].join('\n');
    expect(objectNames(sql)).toEqual(['alpha', 'beta']);
  });
});
