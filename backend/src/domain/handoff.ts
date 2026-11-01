// the handoff is the atomic unit of coordination. state crosses the boundary;
// a summary does not, which is why this type has no free-text payload field.
export type HandoffState = 'offered' | 'accepted' | 'rejected' | 'expired' | 'undelivered';

export interface Handoff {
  id: string;
  from: string;
  to: string;
  /** an expression the receiver can evaluate against real state */
  precondition: string;
  /** an artifact pointer, never prose. e.g. artifact://builds/1f2a */
  payloadRef: string;
  acceptanceRequired: boolean;
  timeoutMs: number;
  offeredAt: string;
  state: HandoffState;
  rejectionReason?: string;
}

const ARTIFACT = /^(artifact|repo|db|doc|url):\/\/.+/;

export function validateHandoff(h: Handoff): string[] {
  const errors: string[] = [];
  if (!ARTIFACT.test(h.payloadRef)) errors.push('payload_ref_must_be_a_reference');
  if (h.precondition.trim().length === 0) errors.push('precondition_required');
  if (h.timeoutMs <= 0) errors.push('timeout_required');
  if (h.from === h.to) errors.push('self_handoff');
  return errors;
}

export function isOverdue(h: Handoff, now: string): boolean {
  if (h.state !== 'offered') return false;
  return Date.parse(now) - Date.parse(h.offeredAt) > h.timeoutMs;
}

export type HandoffEvent =
  | { type: 'accept'; actor: string; preconditionHeld: boolean }
  | { type: 'reject'; actor: string; reason: string }
  | { type: 'transport_failed'; reason: string };

export function transition(h: Handoff, event: HandoffEvent, now: string): Handoff {
  if (h.state !== 'offered') {
    throw new Error(`cannot ${event.type} a handoff in state ${h.state}`);
  }
  if (isOverdue(h, now)) throw new Error('handoff timed out before this event');
  switch (event.type) {
    case 'accept':
      if (event.actor !== h.to) throw new Error('only the addressee may accept');
      if (!event.preconditionHeld) throw new Error('precondition not satisfied: refuse, do not accept');
      return { ...h, state: 'accepted' };
    case 'reject':
      if (event.actor !== h.to) throw new Error('only the addressee may reject');
      return { ...h, state: 'rejected', rejectionReason: event.reason };
    case 'transport_failed':
      return { ...h, state: 'undelivered', rejectionReason: event.reason };
  }
}

/** expiry is an event, not an absence. this is what turns a silent drop into a row. */
export function expire(h: Handoff, now: string): Handoff {
  return isOverdue(h, now) ? { ...h, state: 'expired' } : h;
}

export function openHandoffs(list: Handoff[], now: string): Handoff[] {
  return list.filter((h) => h.state === 'offered' && isOverdue(h, now));
}

/**
 * parallel mode: partitions are exhaustive. a partition with no owner is an
 * alarm, not a gap, because nobody is coming to pick it up later.
 */
export function orphanPartitions(
  partitions: string[],
  assignments: Record<string, string | null>,
): string[] {
  return partitions.filter((p) => !assignments[p]);
}
