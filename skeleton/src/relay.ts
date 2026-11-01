// a sandbox is isolation plus permeability. isolation is what cannot cross;
// permeability is what may cross, in which direction, at what rate, under whose name.
export interface Crossing {
  id: string
  from: string
  to: string
  kinds: string[]
  maxPerHour: number
  expiresAt: string
  configHash: string
}

export interface Envelope {
  id: string
  from: string
  to: string
  kind: string
  payloadRef: string // a reference, never prose
  dedupeKey: string
  hops: number
  path: string[]
  expiresAt: string
}

// rules: default deny, no implicit reverse direction, no inheritance from a parent
// tier, and the crossing's config hash travels with the message so the audit can
// prove which version of the door was open.
