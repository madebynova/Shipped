import type { ScopeLevel } from './types'

// Money is the clock. Every sprint costs a base upkeep, and a bigger game costs more
// to keep alive: that is how overscoping can run you out of money. A lean, disciplined
// game reaches the deadline with cash to spare.

export const BASE_UPKEEP = 45

/** Extra upkeep per sprint at each scope level. */
export const SCOPE_UPKEEP: Record<ScopeLevel, number> = {
  LOW: 0,
  MEDIUM: 5,
  HIGH: 15,
  CRITICAL: 100,
}

/** What closing a sprint costs at this scope level. */
export function sprintUpkeep(level: ScopeLevel): number {
  return BASE_UPKEEP + SCOPE_UPKEEP[level]
}
