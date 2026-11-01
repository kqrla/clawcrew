// nothing is a timer. every future action is a row, so a restart is not an event.
export type CatchUp = 'skip' | 'coalesce' | 'burst'

export interface Schedule {
  id: string
  kind: string
  ref: string
  tier: string
  everySeconds: number
  catchUp: CatchUp
  nextDueAt: string
  lastFireKey: string | null
  enabled: boolean
}

export function missedSlots(_s: Schedule, _now: string): string[] {
  // TODO: skip returns none, coalesce returns the first, burst returns all.
  // TODO: advance from the scheduled instant, never from now, or the clock drifts.
  throw new Error('not implemented')
}

// health is lag, not liveness. a stopped ticker is caught by its own silence.
