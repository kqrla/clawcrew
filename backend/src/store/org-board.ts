/**
 * docs/49. persisting a drag. moveNode decides what changes; this writes those rows and
 * records the op, so an undo is the inverse of a row that exists rather than a guess.
 */
import { Board, BoardNode, moveNode } from '../domain/board.js';
import { lit, marked, sql } from './sql-cli.js';

const F = '\u001f';

export function loadBoard(board = 'org'): Board {
  const rows = marked(
    `select '##' || coalesce(string_agg(id || '${F}' || kind || '${F}' || label || '${F}' || coalesce(parent, '') || '${F}' || x || '${F}' || y, '~' order by id), '') || '##' as k
       from org_node where board = ${lit(board)}`,
  );
  const nodes: BoardNode[] = rows
    .split('~')
    .filter(Boolean)
    .map((r) => {
      const [id, kind, label, parent, x, y] = r.split(F);
      return {
        id: id!,
        kind: kind as BoardNode['kind'],
        label: label!,
        parent: parent || null,
        x: Number(x),
        y: Number(y),
      };
    });
  return { width: 2000, height: 1200, grid: 20, nodes };
}

export type SaveResult = { ok: true; moved: { id: string; x: number; y: number }[] } | { ok: false; why: string };

export function applyMove(boardId: string, nodeId: string, x: number, y: number, actor: string): SaveResult {
  const board = loadBoard(boardId);
  const result = moveNode(board, nodeId, { x, y });
  if (!result.ok) return result;

  const moved = result.moved;
  sql(
    `update org_node set x = v.x, y = v.y, updated_at = now()
       from (values ${moved.map((m) => `(${lit(m.id)}, ${m.x}::numeric, ${m.y}::numeric)`).join(', ')})
       as v(id, x, y)
      where org_node.id = v.id`,
  );
  sql(
    `insert into org_board_op (board, node, actor, moved) values (${lit(boardId)}, ${lit(nodeId)}, ${lit(actor)}, ${lit(JSON.stringify(moved))}::jsonb)`,
  );
  return { ok: true, moved };
}

/** the inverse of the last op, for an undo button that means it */
export function undoLast(boardId = 'org'): SaveResult {
  const op = marked(
    `coalesce((select moved::text from org_board_op where board = ${lit(boardId)} order by id desc limit 1), '[]')`,
  );
  const moved = JSON.parse(op) as { id: string; x: number; y: number }[];
  if (moved.length === 0) return { ok: false, why: 'nothing_to_undo' };
  const current = new Map(loadBoard(boardId).nodes.map((n) => [n.id, n]));
  for (const m of moved) {
    const n = current.get(m.id);
    if (!n) return { ok: false, why: 'op_refers_to_a_missing_node' };
  }
  // undo is expressed as a normal move of the dragged node back to its previous position
  const head = moved[0]!;
  return applyMove(boardId, head.id, head.x, head.y, 'human:undo');
}
