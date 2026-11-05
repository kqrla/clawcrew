/**
 * docs/49. a page and three routes, so the whiteboard is something a person can drag rather
 * than a table with coordinates. node:http and node-pg only: this runs on a box with node.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cell, lit } from '../src/store/sql-cli.js';
import { applyMove, loadBoard, undoLast } from '../src/store/org-board.js';

const PORT = Number(process.env.PORT ?? 8099);
// the page lives at the repo root, and the server is started from backend/
const PAGE = [join(process.cwd(), 'web', 'board.html'), join(process.cwd(), '..', 'web', 'board.html')].find((p) => existsSync(p)) ?? '';

const json = (res: any, code: number, body: unknown): void => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (url.pathname === '/' || url.pathname === '/board') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(readFileSync(PAGE));
      return;
    }
    if (url.pathname === '/api/board') return json(res, 200, loadBoard(url.searchParams.get('board') ?? 'org'));
    if (url.pathname === '/api/rooms') {
      return json(res, 200, cell(`coalesce(string_agg(id || '|' || kind || '|' || name, ';'), '')`, 'bc_room'));
    }
    if (url.pathname === '/api/messages') {
      const room = lit(url.searchParams.get('room') ?? 'a2a');
      const body = cell(
        `coalesce(string_agg(author || \\u001f || author_kind || \\u001f || replace(body, chr(10), ' ') || \\u001f || coalesce(envelope::text, ''), '~' order by at desc limit 30), '')`,
        `bc_message where room = ${room}`,
      );
      return json(res, 200, { rows: body });
    }
    if (url.pathname === '/api/move' && req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        try {
          const { id, x, y, actor } = JSON.parse(raw);
          json(res, 200, applyMove('org', String(id), Number(x), Number(y), String(actor ?? 'human:you')));
        } catch (e) {
          json(res, 400, { ok: false, why: 'unreadable_body' });
        }
      });
      return;
    }
    if (url.pathname === '/api/undo' && req.method === 'POST') return json(res, 200, undoLast('org'));
    json(res, 404, { ok: false, why: 'no_route' });
  } catch (e) {
    json(res, 500, { ok: false, why: String((e as Error).message).slice(0, 200) });
  }
}).listen(PORT, () => console.log(`board on http://localhost:${PORT}`));
