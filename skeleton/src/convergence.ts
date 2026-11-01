// parallel teams work decoupled, then converge. convergence is a record, not a meeting.
export type Join = 'all' | 'quorum' | 'first_success'

export interface Partition {
  id: string
  ownerTier: string
}

export interface Report {
  tier: string
  partition: string
  outcome: 'result' | 'not_applicable' | 'blocked'
  artifactRef?: string
  reason?: string
  at: string
}

// rules: the partition map is exhaustive; a tier may only report on a partition it
// owns; silence is not a result; blocked resolves nothing; and the gate needs the
// parent metric measured, so teams cannot converge by agreeing with each other.
