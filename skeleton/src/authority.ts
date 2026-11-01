// authority is computed, never declared. a seat holds what every tier above it allows.
export interface GrantSet {
  tools: string[]
  spendUsdPerDay?: number
}

// root-first chain, ending at the seat's own tier
export type Chain = { id: string; ceiling: GrantSet }[]

export function effectiveHome(_chain: Chain, _own: GrantSet): GrantSet {
  // TODO: intersect down the chain. never union.
  throw new Error('not implemented')
}

export function effectiveInHost(_hostChain: Chain, _own: GrantSet, _scope: GrantSet): GrantSet {
  // TODO: host ceiling ∩ secondment scope ∩ own. the home chain does not travel.
  throw new Error('not implemented')
}

// invariant: intersection only ever narrows. the single widening path is an
// elevation: issued by an ancestor, bounded by its own ceiling, expiring.
