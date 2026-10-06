import {
  COMPLETE_BONUS,
  COMPLETE_MIN_FEATURES,
  MIN_RECOVERY_CREDIT,
  SKEPTICISM_BELOW,
  SKEPTICISM_PER_POINT,
} from './config'
import { cancelPenalty, promisePenalty, promisedFeatures, unresolvedPromises } from './promises'
import { bandFor, computeReview } from './review'
import type { LegacyScore, RunState } from './types'

// THE LEGACY SCORE: how good the game is *now*. The launch score never changes; this one moves.
//
//   legacy = the review formula re-run on the game as it stands today
//            - skepticism        (a rough launch: improvements count for less)
//            - promise penalty   (promised features still unbuilt)
//            - cancel penalty    (promises you formally cancelled)
//            + COMPLETE bonus    (everything polished, no bugs, no broken promises)
//
// It is a pure function of the run, so the UI can show it live and a test can pin every number.

/** How much of an improvement the audience believes: 100% for a decent launch, less for a rough one. */
export function recoveryCredit(launchScore: number): number {
  const credit = 1 - Math.max(0, SKEPTICISM_BELOW - launchScore) * SKEPTICISM_PER_POINT
  return Math.max(MIN_RECOVERY_CREDIT, Math.min(1, credit))
}

/**
 * COMPLETE: every feature that is built is POLISHED, there are no bugs, and every promised feature is built
 * (so none is still waiting and none was cancelled: a cancelled feature stays unbuilt). Reachable with a lean,
 * finished game: you do not have to build all six features, only finish what you started and what you
 * promised. It does take at least four: a game of one to three features is a small game, not a complete one.
 *
 * It describes the state of the game, so it counts whether the game gets there before launch or through
 * updates, and whether it is retired straight from the review or later.
 */
export function isComplete(state: RunState): boolean {
  const built = state.features.filter((f) => f.state !== 'PLANNED')
  const promisesKept = promisedFeatures(state.concept).every((id) => {
    const feature = state.features.find((f) => f.id === id)
    return feature === undefined || feature.state !== 'PLANNED'
  })
  return (
    built.length >= COMPLETE_MIN_FEATURES &&
    built.every((f) => f.state === 'POLISHED') &&
    state.bugs === 0 &&
    promisesKept
  )
}

/**
 * The legacy score of a shipped, live or retired game. Retiring straight from the review (no updates
 * ever launched) leaves it equal to the launch score, plus the COMPLETE bonus if the game earned it.
 */
export function computeLegacy(state: RunState): LegacyScore {
  const launch = state.review
  if (!launch) throw new Error('Only a shipped game has a legacy score')
  const live = state.live

  if (!live) {
    // No updates were ever launched, so there is nothing to discount or to wait on: the game is what it shipped as.
    const complete = isComplete(state)
    const completeBonus = complete ? COMPLETE_BONUS : 0
    const score = Math.min(100, launch.score + completeBonus)
    return {
      score,
      band: bandFor(score),
      review: launch.score,
      promisePenalty: 0,
      cancelPenalty: 0,
      skepticism: 0,
      completeBonus,
      complete,
      unresolved: [],
    }
  }

  const now = computeReview(state, launch.forced).score
  // Only improvements are discounted. If the game got worse, the audience believes every point of it.
  const gain = now - live.launchScore
  const skepticism = gain > 0 ? Math.round(gain * (1 - recoveryCredit(live.launchScore))) : 0
  const complete = isComplete(state)
  const parts = {
    promisePenalty: promisePenalty(state),
    cancelPenalty: cancelPenalty(state),
    skepticism,
    completeBonus: complete ? COMPLETE_BONUS : 0,
  }
  const score = Math.max(0, Math.min(100, now - parts.skepticism - parts.promisePenalty - parts.cancelPenalty + parts.completeBonus))
  return { score, band: bandFor(score), review: now, ...parts, complete, unresolved: unresolvedPromises(state) }
}
