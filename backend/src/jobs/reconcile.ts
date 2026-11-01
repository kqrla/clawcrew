/**
 * the weekly projection reconciliation.
 *
 * the job exists to answer one question: does the board agree with the record.
 * it never resolves a disagreement in the board's favour, and it never changes
 * local state. repair is always a re-push from the record.
 */
export type LocalState = 'open' | 'in_progress' | 'done' | 'blocked';

export interface MappedCard {
  taskId: string;
  remoteId: string;
  localState: LocalState;
}

export interface RemoteCard {
  state: string | null;
}

export interface ReconcilePorts {
  listMapped(): Promise<MappedCard[]>;
  fetchRemote(remoteId: string): Promise<RemoteCard | null>;
  repush(card: MappedCard): Promise<void>;
  emit(finding: ProjectionFinding): Promise<void>;
}

export type ProjectionFindingKind = 'projection_drift' | 'projection_lost' | 'projection_unreadable';

export interface ProjectionFinding {
  kind: ProjectionFindingKind;
  taskId: string;
  remoteId: string;
  local: LocalState;
  remote: string | null;
  actionRequired: string;
  severity: 'drift' | 'integrity';
}

const REMOTE_STATES: Record<string, LocalState> = {
  todo: 'open',
  backlog: 'open',
  unstarted: 'open',
  'in progress': 'in_progress',
  started: 'in_progress',
  done: 'done',
  completed: 'done',
  blocked: 'blocked',
  cancelled: 'blocked',
};

export function normalizeRemote(state: string | null): LocalState | 'unknown' {
  if (state === null) return 'unknown';
  return REMOTE_STATES[state.trim().toLowerCase()] ?? 'unknown';
}

export interface ReconcileSummary {
  checked: number;
  drift: number;
  lost: number;
  unreadable: number;
  findings: ProjectionFinding[];
}

export async function reconcileProjections(ports: ReconcilePorts): Promise<ReconcileSummary> {
  const cards = await ports.listMapped();
  const findings: ProjectionFinding[] = [];
  let drift = 0;
  let lost = 0;
  let unreadable = 0;

  for (const card of cards) {
    const remote = await ports.fetchRemote(card.remoteId);

    if (remote === null) {
      lost += 1;
      const finding: ProjectionFinding = {
        kind: 'projection_lost',
        taskId: card.taskId,
        remoteId: card.remoteId,
        local: card.localState,
        remote: null,
        actionRequired: 're-created from the record on this run; if it recurs, the mapping is stale',
        severity: 'drift',
      };
      findings.push(finding);
      await ports.emit(finding);
      await ports.repush(card);
      continue;
    }

    const matched = normalizeRemote(remote.state);
    if (matched === 'unknown') {
      unreadable += 1;
      const finding: ProjectionFinding = {
        kind: 'projection_unreadable',
        taskId: card.taskId,
        remoteId: card.remoteId,
        local: card.localState,
        remote: remote.state,
        actionRequired: 'add the remote state to the mapping table or fix the board schema',
        severity: 'integrity',
      };
      findings.push(finding);
      await ports.emit(finding);
      continue;
    }

    if (matched !== card.localState) {
      drift += 1;
      const finding: ProjectionFinding = {
        kind: 'projection_drift',
        taskId: card.taskId,
        remoteId: card.remoteId,
        local: card.localState,
        remote: remote.state,
        actionRequired:
          matched === 'done'
            ? 'someone closed this on the board: completion still needs evidence, so the card was reset'
            : 'board disagreed with the record; the record wins and the card was reset',
        severity: 'drift',
      };
      findings.push(finding);
      await ports.emit(finding);
      await ports.repush(card);
    }
  }

  return { checked: cards.length, drift, lost, unreadable, findings };
}
