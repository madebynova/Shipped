import { getGenre } from '../content/genres'
import {
  BUZZ_PER_HYPE,
  EARLY_RELEASE_FACTOR,
  FIRST_WEEK_BASE,
  FIRST_WEEK_FLOOR,
  FIRST_WEEK_PER_POINT,
  LIVE_HYPE_DECAY,
  SALES_DECAY_BASE,
  SALES_DECAY_PER_POINT,
  SALES_TAIL_SHARE,
  SPIKE_PER_LEGACY_POINT,
  SPIKE_PER_NEW_FEATURE,
} from './config'
import type { Genre, SalesBreakdown, ScopeLevel } from './types'

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

/* ------------------------------------------------------------------------------------------
   After launch. The team shrinks to a live crew, so it is cheaper than development, but it is
   paid out of sales instead of the starting $500.
   ------------------------------------------------------------------------------------------ */

export const LIVE_BASE_UPKEEP = 40

/** Extra live upkeep per sprint at each scope level. A huge game is still a costly one to keep running. */
export const LIVE_SCOPE_UPKEEP: Record<ScopeLevel, number> = {
  LOW: 0,
  MEDIUM: 5,
  HIGH: 12,
  CRITICAL: 35,
}

/** What closing a live sprint costs at this scope level. */
export function liveUpkeep(level: ScopeLevel): number {
  return LIVE_BASE_UPKEEP + LIVE_SCOPE_UPKEEP[level]
}

/**
 * First-week sales. It is shown on the review, and it opens the revenue account.
 * Score matters most, hype adds copies on day one (even for a bad game), genre sets the audience size.
 */
export function firstWeekSales(score: number, hype: number, genre: Genre): SalesBreakdown {
  const base = FIRST_WEEK_BASE + FIRST_WEEK_PER_POINT * Math.max(0, score - FIRST_WEEK_FLOOR)
  const hypeMultiplier = 1 + hype / 100
  const marketMultiplier = getGenre(genre).market
  return { base, hypeMultiplier, marketMultiplier, total: Math.round(base * hypeMultiplier * marketMultiplier) }
}

/** Sales per sprint once the first week is over: a share of the first week. */
export function startingSales(firstWeek: number): number {
  return Math.round(firstWeek * SALES_TAIL_SHARE)
}

/** How much of this sprint's sales are still there next sprint. A better game fades more slowly. */
export function salesDecay(legacyScore: number): number {
  return Math.max(0.5, Math.min(0.95, SALES_DECAY_BASE + SALES_DECAY_PER_POINT * legacyScore))
}

/** Hype after launch is "buzz": every point adds a little to the money coming in. */
export function incomeFor(sales: number, hype: number): number {
  return Math.round(sales * (1 + hype * BUZZ_PER_HYPE))
}

/** Buzz fades by itself. */
export function fadeHype(hype: number): number {
  return Math.round(hype * LIVE_HYPE_DECAY)
}

/**
 * The sales boost an update brings, added to sales per sprint (so it fades like any sales).
 * It grows with how much better the game is since the last release and with each new feature,
 * and a loud game (hype) sells an update harder. An update with nothing new in it earns nothing.
 */
export function releaseSpike(legacyGain: number, newFeatures: number, hype: number, early: boolean): number {
  const raw = SPIKE_PER_LEGACY_POINT * Math.max(0, legacyGain) + SPIKE_PER_NEW_FEATURE * newFeatures
  return Math.round(raw * (1 + hype / 100) * (early ? EARLY_RELEASE_FACTOR : 1))
}

/**
 * How many more sprints the revenue account can pay for if nothing new happens (no releases):
 * sales keep fading, buzz keeps fading, upkeep stays the same. Capped so the UI can say "99+".
 */
export function runwayFor(bank: number, sales: number, hype: number, decay: number, upkeep: number, cap = 99): number {
  let money = bank
  let income = sales
  let buzzHype = hype
  for (let sprints = 0; sprints < cap; sprints++) {
    money += incomeFor(income, buzzHype) - upkeep
    if (money < 0) return sprints
    income *= decay
    buzzHype = fadeHype(buzzHype)
  }
  return cap
}
