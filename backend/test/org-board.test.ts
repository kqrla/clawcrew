import { describe, expect, it } from 'vitest';
import { setRunner } from '../src/store/sql-cli.js';
import { applyMove, loadBoard } from '../src/store/org-board.js';

/** docs/49. the persist path writes what moveNode decided, and nothing else. */
const F = '\u001f';
const statements: string[] = [];

function fakeBoard(rows: string[]): void {
  setRunner({
    name: 'fake',
    run(stmt) {
      statements.push(stmt);
      if (/coalesce\(string_agg/.test(stmt)) return `##${rows.join('~')}##`;
      return '##ok##';
    },
  });
}

const rows = [
  ['directive', 'tier', 'directive', '', 100, 20].join(F),
  ['support', 'department', 'support', 'directive', 100, 100].join(F),
  ['seat.support', 'seat', 'seat support', 'support', 100, 180].join(F),
];

describe('saving a drag', () => {
  it('loads the board from positions, not from a layout engine', () => {
    fakeBoard(rows);
    const b = loadBoard('org');
    expect(b.nodes.map((n) => n.id)).toEqual(['directive', 'support', 'seat.support']);
    expect(b.nodes[1]).toMatchObject({ parent: 'directive', x: 100, y: 100 });
  });

  it('writes exactly the nodes the move said changed, and records the op', () => {
    fakeBoard(rows);
    statements.length = 0;
    const r = applyMove('org', 'support', 140, 100, 'human:anne');
    expect(r).toEqual({ ok: true, moved: [
      { id: 'support', x: 140, y: 100 },
      { id: 'seat.support', x: 140, y: 180 },
    ] });
    const updates = statements.filter((s) => /update org_node/.test(s));
    expect(updates).toHaveLength(1);
    expect(updates[0]).toContain("('support'");
    expect(updates[0]).not.toContain('directive');
    expect(statements.some((s) => /insert into org_board_op/.test(s))).toBe(true);
  });

  it('writes nothing at all when the drop is refused', () => {
    fakeBoard(rows);
    statements.length = 0;
    const r = applyMove('org', 'support', 100, 20, 'human:anne');
    expect(r).toEqual({ ok: false, why: 'would_overlap' });
    expect(statements.filter((s) => /update org_node|insert into org_board_op/.test(s))).toHaveLength(0);
  });
});
