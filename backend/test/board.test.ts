import { describe, expect, it } from 'vitest';
import { Board, moveNode } from '../src/domain/board.js';

/** docs/49. one drag, one op, a bounded set of consequences. */
const board: Board = {
  width: 400,
  height: 400,
  grid: 20,
  nodes: [
    { id: 'directive', kind: 'tier', label: 'directive', parent: null, x: 100, y: 20 },
    { id: 'support', kind: 'department', label: 'support', parent: 'directive', x: 100, y: 100 },
    { id: 'seat.support', kind: 'seat', label: 'seat', parent: 'support', x: 100, y: 180 },
    { id: 'code', kind: 'department', label: 'code', parent: 'directive', x: 200, y: 100 },
  ],
};

describe('dragging on the org chart', () => {
  it('moves a leaf and nothing else', () => {
    expect(moveNode(board, 'code', { x: 240, y: 140 })).toEqual({
      ok: true,
      moved: [{ id: 'code', x: 240, y: 140 }],
    });
  });

  it('carries the branch when a parent moves', () => {
    const r = moveNode(board, 'support', { x: 120, y: 100 });
    expect(r.ok && r.moved.map((m) => m.id)).toEqual(['support', 'seat.support']);
  });

  it('snaps to the grid instead of inventing a pixel position', () => {
    const r = moveNode(board, 'code', { x: 233, y: 141 });
    expect(r.ok && r.moved[0]).toEqual({ id: 'code', x: 240, y: 140 });
  });

  it('refuses a drag that would stack two boxes', () => {
    expect(moveNode(board, 'code', { x: 100, y: 20 })).toEqual({ ok: false, why: 'would_overlap' });
  });

  it('refuses a drag off the board, and refuses an unknown node', () => {
    expect(moveNode(board, 'code', { x: 900, y: 20 })).toEqual({ ok: false, why: 'off_board' });
    expect(moveNode(board, 'nope', { x: 20, y: 20 })).toEqual({ ok: false, why: 'unknown_node' });
  });
});
