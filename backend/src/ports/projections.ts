/**
 * projections are how humans read the org. they are never how the org decides.
 *
 * one way out: orchart writes cards. proposal only in: a webhook that asks for a
 * transition becomes a proposal, and the evidence policy answers it.
 */
export interface TaskCard {
  taskId: string;
  title: string;
  body: string;
  objectiveId: string | null;
  tier: string;
  state: 'open' | 'in_progress' | 'done' | 'blocked';
  evidenceRef?: string;
}

export interface ProjectionMap {
  get(taskId: string): Promise<string | null>;
  set(taskId: string, remoteId: string): Promise<void>;
}

export function memoryMap(): ProjectionMap {
  const m = new Map<string, string>();
  return {
    async get(id) {
      return m.get(id) ?? null;
    },
    async set(id, remote) {
      m.set(id, remote);
    },
  };
}

export interface IssueProjection {
  ensure(card: TaskCard): Promise<string>;
  update(remoteId: string, card: TaskCard): Promise<void>;
}

export interface PlaneOptions {
  baseUrl: string;
  apiKey: string;
  workspaceSlug: string;
  projectId: string;
  map?: ProjectionMap;
  fetchImpl?: typeof fetch;
}

/** thin on purpose. a thick adapter is a lock-in with extra steps. */
export function planeProjection(opts: PlaneOptions): IssueProjection {
  const doFetch = opts.fetchImpl ?? fetch;
  const map = opts.map ?? memoryMap();
  const base = `${opts.baseUrl.replace(/\/$/, '')}/api/v1/workspaces/${opts.workspaceSlug}/projects/${opts.projectId}`;

  async function call(path: string, init: RequestInit) {
    const res = await doFetch(`${base}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-api-key': opts.apiKey,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`plane ${path} failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  const stateFor = (s: TaskCard['state']) =>
    s === 'done' ? 'Done' : s === 'blocked' ? 'Blocked' : s === 'in_progress' ? 'In Progress' : 'Todo';

  return {
    async ensure(card) {
      const existing = await map.get(card.taskId);
      if (existing) {
        await this.update(existing, card);
        return existing;
      }
      const created = await call('/issues/', {
        method: 'POST',
        body: JSON.stringify({
          name: card.title,
          description_html: `<p>${card.body}</p><p><code>orchart:${card.taskId}</code></p>`,
          state: stateFor(card.state),
        }),
      });
      const id = String(created.id);
      await map.set(card.taskId, id);
      return id;
    },
    async update(remoteId, card) {
      await call(`/issues/${remoteId}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: card.title,
          description_html: `<p>${card.body}</p><p><code>orchart:${card.taskId}</code></p>`,
          state: stateFor(card.state),
        }),
      });
    },
  };
}

export type InboundEvent =
  | { kind: 'completion_request'; remoteId: string; actor: string }
  | { kind: 'comment'; remoteId: string; body: string }
  | { kind: 'ignored'; reason: string };

/** a webhook is untrusted input, like any tool result. */
export function interpretPlaneWebhook(body: unknown): InboundEvent {
  if (typeof body !== 'object' || body === null) return { kind: 'ignored', reason: 'not_an_object' };
  const b = body as Record<string, unknown>;
  const data = (b.data ?? {}) as Record<string, unknown>;
  const remoteId = data.id ? String(data.id) : null;
  if (!remoteId) return { kind: 'ignored', reason: 'no_issue_id' };
  const actor = typeof b.actor === 'object' && b.actor ? String((b.actor as Record<string, unknown>).email ?? 'unknown') : 'unknown';
  if (b.event === 'issue' && (b.action === 'updated' || b.action === 'created')) {
    const state = String(data.state ?? '').toLowerCase();
    if (state === 'done' || state === 'completed') return { kind: 'completion_request', remoteId, actor };
    return { kind: 'ignored', reason: 'not_a_completion' };
  }
  if (b.event === 'issue_comment') {
    return { kind: 'comment', remoteId, body: String(data.comment_stripped ?? data.comment_html ?? '') };
  }
  return { kind: 'ignored', reason: 'unhandled_event' };
}

export interface GuardVerdict {
  accepted: boolean;
  reason?: string;
  proposal?: { kind: 'evidence_required'; taskRef: string };
}

/**
 * the whole point of a projection. someone drags a card to done in the board;
 * the board is not the record, so the answer is a request for evidence.
 */
export function guardCompletion(
  ev: InboundEvent,
  task: { id: string; state: string },
  opts: { closureOk: boolean },
): GuardVerdict {
  if (ev.kind !== 'completion_request') return { accepted: false, reason: 'not_a_completion_request' };
  if (!opts.closureOk) {
    return {
      accepted: false,
      reason: 'completion_requires_evidence',
      proposal: { kind: 'evidence_required', taskRef: task.id },
    };
  }
  return { accepted: true };
}

export interface ResearchIndex {
  index(input: { url: string; tags: string[]; note?: string }): Promise<{ id: string }>;
}

export interface KarakeepOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

/**
 * karakeep is a reader, not a witness. its ai summaries are tagged run_by:
 * karakeep and can never close an objective, because a summary of a page is
 * not the page.
 */
export function karakeepIndexer(opts: KarakeepOptions): ResearchIndex {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    async index(input) {
      const res = await doFetch(`${opts.baseUrl.replace(/\/$/, '')}/api/v1/bookmarks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify({
          type: 'link',
          url: input.url,
          title: input.note,
          tags: input.tags.map((name) => ({ name })),
        }),
      });
      if (!res.ok) throw new Error(`karakeep index failed: ${res.status}`);
      const body = (await res.json()) as Record<string, unknown>;
      const id = String(body.id ?? (body.bookmark as Record<string, unknown> | undefined)?.id ?? '');
      if (!id) throw new Error('karakeep returned no bookmark id');
      return { id };
    },
  };
}
