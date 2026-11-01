import { Crossing, Envelope, EnvelopeKind, relay } from '../domain/relay.js';
import { Handoff, HandoffState } from '../domain/handoff.js';

/**
 * a2a is a wire protocol, not an authority model.
 *
 * it says how two opaque agents exchange a message and a task. it says nothing
 * about who is allowed to ask whom, which is the part this org cares about. so
 * a2a lives at the boundary as a port: everything the org already built decides
 * whether a message may cross, and a2a only decides what it looks like on the way.
 *
 * all wire-format detail is isolated here on purpose. the spec has churned its
 * discriminator and method names between revisions, so a revision should touch
 * this file and nothing else.
 */
export interface A2APart {
  text?: string;
  data?: Record<string, unknown>;
  file?: { uri: string; mimeType?: string; name?: string };
}

export interface A2AMessage {
  messageId: string;
  role: 'user' | 'agent';
  parts: A2APart[];
  contextId?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export type A2ATaskState =
  | 'submitted'
  | 'working'
  | 'input-required'
  | 'completed'
  | 'canceled'
  | 'failed'
  | 'rejected';

export interface A2ATask {
  id: string;
  contextId: string;
  status: { state: A2ATaskState; timestamp: string; message?: A2AMessage };
  artifacts?: { artifactId: string; name?: string; parts: A2APart[] }[];
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
}

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  protocolVersion: string;
  capabilities: { streaming: boolean; pushNotifications: boolean; stateTransitionHistory: boolean };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkill[];
}

const SKILLS: Record<EnvelopeKind, AgentSkill> = {
  finding: { id: 'relay.finding', name: 'receive finding', description: 'accept a sourced finding with an artifact reference' },
  proposal: { id: 'relay.proposal', name: 'receive proposal', description: 'accept a proposed change, which is reviewed before it acts' },
  request: { id: 'relay.request', name: 'receive request', description: 'accept a work request against a partition you own' },
  signal: { id: 'relay.signal', name: 'receive signal', description: 'accept a threshold or state-change signal' },
  artifact_ref: { id: 'relay.artifact', name: 'receive artifact', description: 'accept a content-addressed artifact reference' },
};

/**
 * an agent card is a *published* document. it is the one part of the org that
 * outsiders can read, so it must be narrowed before it is generated:
 *
 *   - skills are derived from the crossings that were actually authorized,
 *     so the card cannot advertise a capability the tier cannot exercise
 *   - no parent, no siblings, no objectives, no grants, no seat ids.
 *     the card says what this endpoint will accept, never where it sits.
 */
export function cardFor(input: {
  title: string;
  description?: string;
  endpoint: string;
  permittedKinds: EnvelopeKind[];
  version?: string;
  protocolVersion?: string;
}): AgentCard {
  const kinds = [...new Set(input.permittedKinds)].sort();
  return {
    name: input.title,
    description: input.description ?? `orchart endpoint accepting ${kinds.join(', ') || 'nothing'}`,
    url: input.endpoint,
    version: input.version ?? '0.1.0',
    protocolVersion: input.protocolVersion ?? '1.0',
    capabilities: { streaming: false, pushNotifications: true, stateTransitionHistory: true },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: kinds.map((k) => SKILLS[k]),
  };
}

export function envelopeToMessage(env: Envelope): A2AMessage {
  const envPart: Record<string, unknown> = {
    kind: env.kind,
    subject: env.subject,
    payloadRef: env.payloadRef,
    authorityBasis: env.authorityBasis,
    dedupeKey: env.dedupeKey,
    hops: env.hops,
    maxHops: env.maxHops,
    createdAt: env.createdAt,
    expiresAt: env.expiresAt,
    from: env.from,
    to: env.to,
  };
  if (env.replyTo) envPart.replyTo = env.replyTo;
  return {
    messageId: env.id,
    role: 'user',
    contextId: env.dedupeKey,
    parts: [
      { data: { orchart: envPart } },
      ...(env.payloadRef.startsWith('artifact://')
        ? [{ file: { uri: env.payloadRef, mimeType: 'application/octet-stream' } }]
        : []),
    ],
  };
}

export type InboundResult =
  | { ok: true; envelope: Envelope }
  | { ok: false; reason: string };

/**
 * the sender is taken from the authenticated transport, never from the payload.
 * an a2a message is untrusted input: anyone who can reach the endpoint can write
 * metadata, so a self-declared sender is a claim, not an identity.
 */
export function messageToEnvelope(
  msg: A2AMessage,
  ctx: { senderTier: string; receivingTier: string; now: string },
): InboundResult {
  const dataPart = msg.parts.find((p) => p.data?.orchart);
  const raw = dataPart?.data?.orchart as Record<string, unknown> | undefined;
  if (!raw) return { ok: false, reason: 'missing_orchart_data_part' };

  const declared = typeof raw.from === 'string' ? raw.from : undefined;
  if (declared && declared !== ctx.senderTier) {
    return { ok: false, reason: `sender_mismatch:${declared}` };
  }
  if (typeof raw.to === 'string' && raw.to !== ctx.receivingTier) {
    return { ok: false, reason: 'addressed_to_another_tier' };
  }

  const kind = raw.kind as EnvelopeKind | undefined;
  if (!kind || !(kind in SKILLS)) return { ok: false, reason: 'unknown_kind' };

  const envelope: Envelope = {
    id: msg.messageId,
    from: ctx.senderTier,
    to: ctx.receivingTier,
    kind,
    subject: String(raw.subject ?? ''),
    payloadRef: String(raw.payloadRef ?? ''),
    authorityBasis: String(raw.authorityBasis ?? ''),
    createdAt: String(raw.createdAt ?? ctx.now),
    expiresAt: String(raw.expiresAt ?? ctx.now),
    hops: Number(raw.hops ?? 0),
    maxHops: Number(raw.maxHops ?? 2),
    dedupeKey: String(raw.dedupeKey ?? msg.messageId),
    ...(typeof raw.replyTo === 'string' ? { replyTo: raw.replyTo } : {}),
  };
  return { ok: true, envelope };
}

export type InboundAcceptance =
  | { state: 'accepted'; envelope: Envelope }
  | { state: 'duplicate' }
  | { state: 'rejected'; reason: string };

/** the boundary: parse, then ask the sandbox whether this door exists. */
export function acceptInbound(
  msg: A2AMessage,
  crossings: Crossing[],
  ctx: { senderTier: string; receivingTier: string; now: string; perHourCount: number; alreadySeen: boolean },
): InboundAcceptance {
  const parsed = messageToEnvelope(msg, ctx);
  if (!parsed.ok) return { state: 'rejected', reason: parsed.reason };
  const decision = relay(parsed.envelope, crossings, {
    now: ctx.now,
    perHourCount: ctx.perHourCount,
    alreadySeen: ctx.alreadySeen,
  });
  if (decision.state === 'accepted') return { state: 'accepted', envelope: parsed.envelope };
  if (decision.state === 'duplicate') return { state: 'duplicate' };
  return { state: 'rejected', reason: decision.reason };
}

const HANDOFF_TO_TASK: Record<HandoffState, A2ATaskState> = {
  offered: 'submitted',
  accepted: 'working',
  rejected: 'rejected',
  expired: 'canceled',
  undelivered: 'failed',
};

export function handoffToTask(h: Handoff, now: string): A2ATask {
  const task: A2ATask = {
    id: h.id,
    contextId: h.precondition,
    status: {
      state: HANDOFF_TO_TASK[h.state],
      timestamp: now,
      message: {
        messageId: `${h.id}.status`,
        role: 'agent',
        parts: [{ data: { precondition: h.precondition, payloadRef: h.payloadRef } }],
      },
    },
  };
  if (h.state === 'accepted') {
    task.artifacts = [{ artifactId: h.id, name: 'payload', parts: [{ file: { uri: h.payloadRef } }] }];
  }
  return task;
}

/**
 * a completed a2a task is a claim, exactly like a closed plane card.
 * the remote saying "done" is an event about the remote, not evidence about us.
 */
export function completionIsAClaim(task: A2ATask): boolean {
  return task.status.state === 'completed';
}

export interface A2AClientOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  /** the json-rpc method for a send; isolated because revisions have renamed it */
  method?: string;
}

export async function sendMessage(
  endpoint: string,
  msg: A2AMessage,
  opts: A2AClientOptions = {},
): Promise<{ task?: A2ATask; message?: A2AMessage }> {
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: msg.messageId,
      method: opts.method ?? 'message/send',
      params: { message: msg },
    }),
  });
  if (!res.ok) throw new Error(`a2a transport failed: ${res.status}`);
  const body = (await res.json()) as {
    error?: { code: number; message: string };
    result?: { task?: A2ATask; message?: A2AMessage };
  };
  if (body.error) throw new Error(`a2a error ${body.error.code}: ${body.error.message}`);
  return body.result ?? {};
}
