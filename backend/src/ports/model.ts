/**
 * docs/42. the model is a port. this is the only file that names a vendor, and it
 * does not clean up after one: an answer it cannot read is thrown, and the audit
 * decides what counts, not the adapter.
 */
import { Claim } from '../domain/discourse.js';
import { Proposal } from '../domain/turn.js';

export interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

export interface ModelProvider {
  /** what gets written on the row, so a template is never mistaken for a model */
  label: string;
  propose(prompt: {
    task: { id: string; slice: string; kind: string };
    tools: ToolOffer[];
    claims: Claim[];
  }): Promise<Proposal>;
}

export class ModelError extends Error {
  constructor(
    readonly code: 'unreadable' | 'http' | 'timeout' | 'incomplete_configuration',
    message: string,
  ) {
    super(message);
  }
}

/** a tool is offered with the arguments it takes and the values it will accept */
export interface ToolOffer {
  name: string;
  args: { name: string; type: string; allowed?: string[] }[];
}

const INSTRUCTIONS = [
  'you are a seat in an organisation. answer with json only, no prose, no code fences.',
  'every tool you are offered lists its arguments and the values those arguments accept. a call that omits one, or uses a value outside the list, is refused and costs the seat a strike.',
  'shape: {"outcome":"advance"|"block"|"refuse","reason":string,"reply":string,"tool":string,"args":object,"claims":[{"id":string,"kind":"fact"|"inference"|"preference"|"plan","statement":string,"evidence":string,"confidence":number,"by":string}]}',
  'you may only call the tools listed. a fact without an evidence reference is refused.',
  'a stored reply is checked by a second seat: it must name the ticket id and address the specific problem raised, or it is not closed.',
].join('\n');

export function parseProposal(text: string): Proposal {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new ModelError('unreadable', `not json: ${trimmed.slice(0, 120)}`);
  }
  // the model may answer in the loose shape the prompt asks for (tool+args, reply) or
  // the strict one the audit reads (calls, artifacts). both are mapped here, and
  // neither is repaired: a call outside the grant stays in the list for the audit.
  const p = parsed as Record<string, unknown>;
  if (!p || typeof p !== 'object') throw new ModelError('unreadable', 'json but not an object');
  const calls: { tool: string; args: Record<string, unknown> }[] = Array.isArray(p.calls)
    ? (p.calls as { tool: string; args: Record<string, unknown> }[])
    : typeof p.tool === 'string'
      ? [{ tool: p.tool, args: (p.args as Record<string, unknown>) ?? {} }]
      : [];
  const artifacts = Array.isArray(p.artifacts)
    ? (p.artifacts as string[])
    : typeof p.reply === 'string' && p.reply.trim()
      ? [`reply:${p.reply.length}ch`]
      : [];
  return {
    outcome: (typeof p.outcome === 'string' ? p.outcome : 'advance') as Proposal['outcome'],
    reason: typeof p.reason === 'string' ? p.reason : undefined,
    calls,
    artifacts,
    claims: Array.isArray(p.claims) ? (p.claims as Proposal['claims']) : [],
    reply: typeof p.reply === 'string' ? p.reply : '',
  } as Proposal & { reply: string };
}

async function post(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new ModelError('timeout', `no answer within ${timeoutMs}ms`);
    throw new ModelError('http', `the call failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** any provider that speaks the openai chat shape, which is most of them */
export function openAICompatible(cfg: ModelConfig): ModelProvider {
  const timeoutMs = cfg.timeoutMs ?? 60_000;
  return {
    label: `openai:${cfg.model}@${new URL(cfg.baseUrl).host}`,
    async propose(prompt) {
      const res = await post(
        `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          model: cfg.model,
          temperature: 0,
          messages: [
            { role: 'system', content: INSTRUCTIONS },
            { role: 'user', content: JSON.stringify(prompt) },
          ],
        },
        { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
        timeoutMs,
      );
      if (!res.ok) throw new ModelError('http', `${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new ModelError('unreadable', 'the answer had no content');
      return parseProposal(text);
    },
  };
}

export function anthropic(cfg: ModelConfig): ModelProvider {
  const timeoutMs = cfg.timeoutMs ?? 60_000;
  return {
    label: `anthropic:${cfg.model}`,
    async propose(prompt) {
      const res = await post(
        `${cfg.baseUrl.replace(/\/$/, '')}/messages`,
        {
          model: cfg.model,
          max_tokens: 1024,
          system: INSTRUCTIONS,
          messages: [{ role: 'user', content: JSON.stringify(prompt) }],
        },
        { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        timeoutMs,
      );
      if (!res.ok) throw new ModelError('http', `${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = data.content?.find((c) => c.type === 'text')?.text;
      if (!text) throw new ModelError('unreadable', 'the answer had no text block');
      return parseProposal(text);
    },
  };
}

/**
 * a rule, not a model. it exists so the segment runs without a key, and it says so on
 * every row it writes.
 */
export function scripted(label = 'scripted:no-key'): ModelProvider {
  return {
    label,
    async propose(prompt) {
      const ticket = prompt.task as unknown as { id: string; body?: string };
      const body = (ticket.body ?? '').toLowerCase();
      const damaged = body.includes('damag') || body.includes('seam');
      const reply = damaged
        ? `thanks for telling us about ${ticket.id}. we are sending a replacement and a prepaid return label, and no photo is needed at this stage.`
        : `thanks for writing in about ${ticket.id}. we have your note and will come back to you within one working day.`;
      return {
        outcome: 'advance',
        calls: [{ tool: 'inbox.reply', args: { recipient: 'inbox' } }],
        artifacts: [`reply:${reply.length}ch`],
        reply,
        claims: [
          {
            id: `c.${prompt.task.id}`,
            kind: 'fact',
            statement: `replied to ${prompt.task.id}`,
            evidence: `ticket:${prompt.task.id}`,
            confidence: 1,
            by: 'seat.support',
          },
        ],
      } as unknown as Proposal;
    },
  };
}

/** a key in the environment is the whole configuration story */
export function fromEnv(env: NodeJS.ProcessEnv): ModelProvider | null {
  if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_MODEL) {
    return anthropic({
      baseUrl: env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1',
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
    });
  }
  if (env.MODEL_API_KEY && env.MODEL_NAME) {
    const baseUrl = env.MODEL_BASE_URL ?? 'https://api.openai.com/v1';
    const cfg = { baseUrl, apiKey: env.MODEL_API_KEY, model: env.MODEL_NAME };
    return baseUrl.includes('anthropic') ? anthropic(cfg) : openAICompatible(cfg);
  }
  if (env.OPENAI_API_KEY && env.MODEL_NAME) {
    return openAICompatible({
      baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      apiKey: env.OPENAI_API_KEY,
      model: env.MODEL_NAME,
    });
  }
  return null;
}

/**
 * half a configuration is worse than none, because it looks like a model and behaves
 * like a template. anything set but unusable is a refusal, not a fallback.
 */
export function resolveProvider(env: NodeJS.ProcessEnv): ModelProvider {
  const anthropicKey = env.ANTHROPIC_API_KEY;
  const baseKey = env.MODEL_API_KEY;
  if (anthropicKey && env.ANTHROPIC_MODEL) {
    return anthropic({
      apiKey: anthropicKey,
      model: env.ANTHROPIC_MODEL,
      baseUrl: env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1',
    });
  }
  if (baseKey && env.MODEL_NAME) {
    return openAICompatible({
      apiKey: baseKey,
      baseUrl: env.MODEL_BASE_URL ?? 'https://api.openai.com/v1',
      model: env.MODEL_NAME,
    });
  }
  if (anthropicKey || baseKey || env.MODEL_NAME || env.MODEL_BASE_URL) {
    throw new ModelError(
      'incomplete_configuration',
      'a model credential is present but the model name is not; set ANTHROPIC_MODEL or MODEL_NAME',
    );
  }
  return scripted();
}
