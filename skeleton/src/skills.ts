// a skill library is how an org compounds instead of re-deriving. it is also the
// fastest way to propagate a mistake, so every skill carries its own doubts.
export interface Skill {
  id: string
  version: number
  hash: string
  ownerTier: string
  surface: string
  requires: string[] // capability the caller must already hold
  testRef: string
  verifiedAgainst: string // fingerprint of the surface it was proven on
  lastVerifiedAt: string
  status: 'active' | 'stale' | 'retired'
}

// rule: effective = caller grants ∩ skill requirements. a skill may narrow authority;
// it may never widen it. a missing requirement is a refusal, not a prompt.
