/**
 * docs/49. moving things on the org chart.
 *
 * the rule from the facade engine applies to an org chart too: one gesture is one op with a
 * bounded effect. dragging a tier moves that tier and its children, in grid steps, clamped to
 * the board, and returns exactly which nodes changed. no full re-layout, no re-render, and no
 * surprise for the person who moved one box and expects one box to have moved.
 */
export type NodeKind = 'tier' | 'department' | 'bloc' | 'wing' | 'seat';
export interface BoardNode {
  id: string;
  kind: NodeKind;
  label: string;
  parent: string | null;
  x: number;
  y: number;
}
export interface Board {
  width: number;
  height: number;
  grid: number;
  nodes: BoardNode[];
}
export interface Move {
  id: string;
  x: number;
  y: number;
}
export type MoveResult =
  | { ok: true; moved: Move[] }
  | { ok: false; why: 'unknown_node' | 'off_board' | 'would_overlap' };

const clampToGrid = (v: number, max: number, grid: number): number =>
  Math.max(0, Math.min(max, Math.round(v / grid) * grid));

/** descendants first-order, so a move of a parent carries its branch and nothing else */
export function descendants(board: Board, id: string): string[] {
  const out: string[] = [];
  const walk = (parent: string): void => {
    for (const n of board.nodes) {
      if (n.parent === parent) {
        out.push(n.id);
        walk(n.id);
      }
    }
  };
  walk(id);
  return out;
}

export function moveNode(board: Board, id: string, to: { x: number; y: number }): MoveResult {
  const node = board.nodes.find((n) => n.id === id);
  if (!node) return { ok: false, why: 'unknown_node' };

  const x = clampToGrid(to.x, board.width, board.grid);
  const y = clampToGrid(to.y, board.height, board.grid);
  if (to.x < 0 || to.y < 0 || to.x > board.width || to.y > board.height) return { ok: false, why: 'off_board' };

  const dx = x - node.x;
  const dy = y - node.y;
  const moving = [id, ...descendants(board, id)];
  const moved: Move[] = moving.map((m) => {
    const n = board.nodes.find((b) => b.id === m)!;
    return { id: m, x: n.x + dx, y: n.y + dy };
  });

  // two boxes on one square is the one thing a whiteboard must not allow silently
  const occupied = new Set(board.nodes.filter((n) => !moving.includes(n.id)).map((n) => `${n.x},${n.y}`));
  if (moved.some((m) => occupied.has(`${m.x},${m.y}`))) return { ok: false, why: 'would_overlap' };
  if (moved.some((m) => m.x < 0 || m.y < 0 || m.x > board.width || m.y > board.height)) {
    return { ok: false, why: 'off_board' };
  }
  return { ok: true, moved };
}
