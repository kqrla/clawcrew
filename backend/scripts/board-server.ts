/**
 * docs/49. a page and three routes, so the whiteboard is something a person can drag rather
 * than a table with coordinates. node:http and node-pg only: this runs on a box with node.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cell, lit } from '../src/store/sql-cli.js';
import { applyMove, loadBoard, undoLast } from '../src/store/org-board.js';
import { COOKIE, guard, issueSession } from '../src/store/sessions.js';
import { AvatarSpec, avatarSvg } from '../src/domain/avatar.js';

const PASSPHRASE = process.env.BOARD_PASSPHRASE ?? '';

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
    if (url.pathname === '/avatars.js') {
      const bundle = [join(process.cwd(), '..', 'web', 'avatars.js'), join(process.cwd(), 'web', 'avatars.js')]
        .find((f) => existsSync(f));
      if (!bundle) return json(res, 404, { ok: false, why: 'bundle_missing_run_esbuild' });
      res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=3600' });
      res.end(readFileSync(bundle));
      return;
    }
    if (url.pathname === '/api/avatar') {
      // the seed is the node id, so a seat's face is stable across sessions and machines
      const spec: AvatarSpec = { seed: url.searchParams.get('id') ?? 'unknown' };
      const shape = url.searchParams.get('shape');
      const hue = url.searchParams.get('hue');
      const hat = url.searchParams.get('hat');
      if (shape) spec.shape = shape as AvatarSpec['shape'];
      if (hue) spec.hue = Number(hue);
      if (hat) spec.hat = hat as AvatarSpec['hat'];
      res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' });
      res.end(avatarSvg(spec));
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
    if (url.pathname === '/api/session' && req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        let body: any = {};
        try { body = JSON.parse(raw); } catch { return json(res, 400, { ok: false, why: 'unreadable_body' }); }
        if (!PASSPHRASE) return json(res, 503, { ok: false, why: 'no_passphrase_configured' });
        if (String(body.passphrase ?? '') !== PASSPHRASE) return json(res, 401, { ok: false, why: 'wrong_passphrase' });
        const actor = String(body.actor ?? 'human').slice(0, 80);
        const token = issueSession(actor);
        res.writeHead(200, {
          'content-type': 'application/json',
          'set-cookie': `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`,
        });
        res.end(JSON.stringify({ ok: true, actor }));
      });
      return;
    }
    if (url.pathname === '/api/whoami') {
      const g = guard(req.headers.cookie);
      return json(res, 200, { ok: g.ok, actor: g.ok ? g.actor : null, why: g.ok ? undefined : g.why });
    }
    if (url.pathname === '/api/move' && req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        // the body's `actor` is ignored on purpose: it is a claim, and claims are not identity
        const g = guard(req.headers.cookie);
        if (!g.ok) return json(res, 401, { ok: false, why: g.why });
        try {
          const { id, x, y } = JSON.parse(raw);
          json(res, 200, applyMove('org', String(id), Number(x), Number(y), g.actor));
        } catch {
          json(res, 400, { ok: false, why: 'unreadable_body' });
        }
      });
      return;
    }
    if (url.pathname === '/api/undo' && req.method === 'POST') {
      const g = guard(req.headers.cookie);
      if (!g.ok) return json(res, 401, { ok: false, why: g.why });
      return json(res, 200, undoLast('org'));
    }
    json(res, 404, { ok: false, why: 'no_route' });
  } catch (e) {
    json(res, 500, { ok: false, why: String((e as Error).message).slice(0, 200) });
  }
}).listen(PORT, () => console.log(`board on http://localhost:${PORT}`));
