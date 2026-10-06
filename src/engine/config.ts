// Every tunable number in the simulation lives here (or in the small rule tables
// in scope.ts / bugs.ts / morale.ts / economy.ts) so balancing never means hunting
// through logic.
import type { RunConfig } from './types'

/** Length of the full game. */
export const TOTAL_SPRINTS = 8
export const SHIP_UNLOCK_SPRINT = 4
export const SLOTS_PER_SPRINT = 3

export const START_RESOURCES = { money: 500, morale: 70, hype: 0, bugs: 0 } as const

export const FULL_RUN: RunConfig = { kind: 'full', totalSprints: TOTAL_SPRINTS, featureIds: null }

/** "MY FIRST GAME": six sprints, four teaching cards. */
export const TUTORIAL_RUN: RunConfig = {
  kind: 'tutorial',
  totalSprints: 6,
  featureIds: ['combat', 'story', 'crafting', 'customization'],
}

/** Score needed to pass the tutorial and unlock the full game. */
export const TUTORIAL_PASS_SCORE = 50

/** Build points needed per point of feature complexity. */
export const BUILD_COST_PER_COMPLEXITY = 4

/** Quality a feature has the moment it becomes PLAYABLE (before scope/morale scaling). */
export const BASE_QUALITY = 45
/** Quality gained by BUILD on an already-built feature ("rework"): fast, but messy. */
export const EXPAND_QUALITY = 28
/** Quality gained by POLISH: slower, but clean. */
export const POLISH_QUALITY = 18
/** Quality at which a feature counts as POLISHED. */
export const POLISHED_AT = 70
export const MAX_QUALITY = 100

/** POLISH also smooths off this many bugs. */
export const POLISH_BUG_CLEANUP = 1

export const HYPE_GAIN = 12
export const MAX_HYPE = 100
export const REST_GAIN = 15

/** Morale change caused by performing each action. */
export const MORALE_DELTA = {
  BUILD: -4,
  POLISH: -2,
  FIX: -2,
  HYPE: 0, // hype is only about the review: it changes nothing else
  REST: REST_GAIN,
} as const

/** Sprint-end pressure. */
export const BUGGY_THRESHOLD = 10
export const BUGGY_MORALE_PENALTY = 4
export const BROKE_MORALE_PENALTY = 10

/** An unpaid team (money <= 0) works at this fraction of normal strength. */
export const BROKE_EFFICIENCY = 0.7
