import type { GrantSet } from './authority.js'

// a tier is the apex of the pyramid beneath it. depth is unbounded.
// department, bloc, team and pod are labels a human puts on a tier for display.
export interface Tier {
  id: string
  parent: string | null
  label: string
  manager: string | null
  ceiling: GrantSet
  horizonDays: number
  state: 'active' | 'frozen' | 'burned'
}

export interface Seat {
  id: string
  title: string
  homeTier: string
  grants: GrantSet
}

// invariants: one parent, no cycles, one home tier per seat, one owner per surface,
// child ceiling within parent ceiling, child horizon no longer than parent horizon.
