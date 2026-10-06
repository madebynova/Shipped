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

/* ------------------------------------------------------------------------------------------
   POST-LAUNCH: LIVE UPDATES
   After shipping, a full game can keep going. Sales pay for the team; the launch review is
   frozen forever; a LEGACY score tracks how good the game is *now*.
   ------------------------------------------------------------------------------------------ */

// -- Sales ---------------------------------------------------------------------------------
// First-week sales = (FIRST_WEEK_BASE + FIRST_WEEK_PER_POINT x points of score above the floor)
//                    x (1 + hype / 100) x the genre's market size. It opens the revenue account.
export const FIRST_WEEK_BASE = 60
export const FIRST_WEEK_PER_POINT = 5.5
export const FIRST_WEEK_FLOOR = 20

/** Ongoing sales per sprint start at this share of the first week, then fade. */
export const SALES_TAIL_SHARE = 0.09
/** Every live sprint, sales are multiplied by BASE + PER_POINT x legacy score: good games fade slowly. */
export const SALES_DECAY_BASE = 0.72
export const SALES_DECAY_PER_POINT = 0.002

/** Buzz (hype after launch) lifts income by this fraction per point, and fades by 15% a sprint. */
export const BUZZ_PER_HYPE = 0.004
export const LIVE_HYPE_DECAY = 0.85

// -- Updates -------------------------------------------------------------------------------
/** An update window opens every 4 live sprints. You may release earlier, but it sells less. */
export const RELEASE_WINDOW = 4
export const EARLY_RELEASE_FACTOR = 0.6
/**
 * A release adds to sales per sprint: $4 per legacy point above your best published score, and $12 per feature
 * added. Only a new best earns anything, so releasing at a temporary low and re-releasing does not pay twice.
 */
export const SPIKE_PER_LEGACY_POINT = 4
export const SPIKE_PER_NEW_FEATURE = 12

// -- Promises ------------------------------------------------------------------------------
/** A promise left unbuilt hurts the legacy score by 1 point per sprint, up to 4 points. */
export const PROMISE_HURT_PER_SPRINT = 1
export const PROMISE_HURT_CAP = 4
/** Formally cancelling one costs 2 legacy points for good, and 10 hype right away. */
export const CANCEL_PENALTY = 2
export const CANCEL_HYPE_PENALTY = 10

// -- Legacy score --------------------------------------------------------------------------
/**
 * A rough launch makes people skeptical: for a launch under 75, every point of improvement counts for
 * less (2% less per point under 75, never below 40% credit). The legacy score still STARTS equal to the
 * launch score; it is only the climb back that is slower. A launch of 75 or better has no discount, a
 * 70 keeps 90% of its improvements, a 55 keeps 60%, and anything from 45 down keeps 40%. Every launch
 * therefore has a ceiling (launch + credit x the improvement available), which is how a first
 * impression keeps mattering long after launch.
 */
export const SKEPTICISM_BELOW = 75
export const SKEPTICISM_PER_POINT = 0.02
export const MIN_RECOVERY_CREDIT = 0.4
/** The COMPLETE stamp (every built feature POLISHED, no bugs, every promise kept) and the smallest game it can be earned with. */
export const COMPLETE_BONUS = 6
export const COMPLETE_MIN_FEATURES = 4

// -- Events --------------------------------------------------------------------------------
/** Chance that a live sprint opens with an event, and how many sprints an event stays away after it fires. */
export const EVENT_CHANCE = 0.5
export const EVENT_COOLDOWN = 3
