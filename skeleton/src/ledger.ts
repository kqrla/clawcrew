// the objective is the unit that needs protecting, not the task.
export interface Objective {
  id: string
  parent: string | null
  ownerTier: string
  statement: string
  metric: string
  source: string // executable: sql:, http:, git:, run:
  baseline: number
  target: number
  horizonDays: number
  status: 'active' | 'met' | 'failed' | 'retired' | 'superseded'
}

export interface Evidence {
  objective: string
  source: string
  value: number
  computedAt: string
  runBy: string
  artifactRef: string
}

// rule: a parent never closes on the claims of its children. closure needs a value
// computed from the objective's own declared source, after the last amendment.
