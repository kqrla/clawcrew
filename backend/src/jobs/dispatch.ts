/**
 * docs/51. self-direction is a dispatcher, not a loop that waits for tickets.
 *
 * everything built so far answers: the support slice replies to whoever wrote in. an org that
 * only answers is a help desk. this decides what gets worked on next, from the objective
 * ledger, and it refuses with a reason when the honest answer is "nothing".
 */
export interface Seat {
  id: string;
  slice: string;
  onCall: boolean;
}
export interface Candidate {
  taskId: string;
  kind: string;
  slice: string;
  objectiveId: string;
  priority: number;
}
export interface DispatchInput {
  candidates: Candidate[];
  seats: Seat[];
  leasedTaskIds: string[];
  registeredKinds: string[];
}
export type Dispatch =
  | { ok: true; seat: string; taskId: string; kind: string; leaseMs: number }
  | { ok: false; why: 'nothing_ready' | 'no_seat_for_slice' | 'all_seats_leased' | 'kind_unregistered' };

export const LEASE_MS = 15 * 60 * 1000;

export function nextAssignment(input: DispatchInput): Dispatch {
  const known = new Set(input.registeredKinds);
  const ready = input.candidates.filter((c) => !input.leasedTaskIds.includes(c.taskId));
  if (ready.length === 0) return { ok: false, why: 'nothing_ready' };

  // a task whose kind has no evidence rule is unassignable: it could never be marked done,
  // so handing it out would manufacture work that cannot finish
  const dispatchable = ready.filter((c) => known.has(c.kind)).sort((a, b) => b.priority - a.priority || a.taskId.localeCompare(b.taskId));
  if (dispatchable.length === 0) return { ok: false, why: 'kind_unregistered' };

  const leasedSeats = new Set(
    input.candidates
      .filter((c) => input.leasedTaskIds.includes(c.taskId))
      .map((c) => c.slice),
  );
  void leasedSeats;

  let sawSeat = false;
  for (const c of dispatchable) {
    const pool = input.seats.filter((s) => s.onCall && s.slice === c.slice);
    if (pool.length === 0) continue;
    sawSeat = true;
    // lowest id first, so assignment is stable and reviewable rather than arbitrary
    const seat = pool.sort((a, b) => a.id.localeCompare(b.id))[0]!;
    return { ok: true, seat: seat.id, taskId: c.taskId, kind: c.kind, leaseMs: LEASE_MS };
  }
  return { ok: false, why: sawSeat ? 'all_seats_leased' : 'no_seat_for_slice' };
}
