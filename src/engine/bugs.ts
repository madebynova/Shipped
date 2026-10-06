import { BROKE_EFFICIENCY } from './config'
import { moraleEfficiency } from './morale'
import { SCOPE_EFFICIENCY } from './scope'
import type { MoraleTier, ScopeLevel } from './types'

// The one rule behind bugs: more game + more building + a tired team = more bugs.

/** Extra bugs a BUILD creates because the game is already big. */
const BUILD_SCOPE_BUGS: Record<ScopeLevel, number> = {
  LOW: 0,
  MEDIUM: 0,
  HIGH: 1,
  CRITICAL: 2,
}

/** Bugs that creep in by themselves at the end of every sprint. */
const DRIFT_BY_SCOPE: Record<ScopeLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
}

const BASE_FIX = 4

/** Bugs created by one BUILD action. */
export function bugsFromBuild(level: ScopeLevel, tier: MoraleTier): number {
  return 1 + BUILD_SCOPE_BUGS[level] + (tier === 'BURNED OUT' ? 1 : 0)
}

/** Bugs that appear at sprint end purely because the game is large / the team is wrecked. */
export function bugDrift(level: ScopeLevel, tier: MoraleTier): number {
  return DRIFT_BY_SCOPE[level] + (tier === 'BURNED OUT' ? 1 : 0)
}

/** Bugs removed by one FIX action. */
export function fixPower(level: ScopeLevel, tier: MoraleTier, broke = false): number {
  const unpaid = broke ? BROKE_EFFICIENCY : 1
  return Math.max(1, Math.round(BASE_FIX * SCOPE_EFFICIENCY[level] * moraleEfficiency(tier) * unpaid))
}

export type Stability = 'STABLE' | 'SHAKY' | 'BUGGY' | 'BROKEN'

export function stability(bugs: number): Stability {
  if (bugs <= 2) return 'STABLE'
  if (bugs <= 6) return 'SHAKY'
  if (bugs <= 11) return 'BUGGY'
  return 'BROKEN'
}
