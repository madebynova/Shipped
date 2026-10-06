import { getGenre } from '../content/genres'
import { CANCEL_HYPE_PENALTY, CANCEL_PENALTY, PROMISE_HURT_CAP, PROMISE_HURT_PER_SPRINT } from './config'
import { addLog, findFeature, withFeature } from './state'
import type { Concept, FeatureId, FeaturePromise, RunState } from './types'

// PROMISES. A pitch promises a few features: the concept gallery gives each game 2-3 seed
// features, and a concept written by hand falls back to its genre's two signature features.
// Whatever is promised but not in the build at launch becomes a promise to finish later.
//
// Nothing here touches the LAUNCH score. Promises only matter after launch, where an unbuilt one
// keeps hurting the legacy score until it is built or formally cancelled.

/** The features this concept promises. */
export function promisedFeatures(concept: Concept): FeatureId[] {
  const seeds = concept.seedFeatures
  return seeds && seeds.length > 0 ? [...seeds] : [...getGenre(concept.genre).signature]
}

/** At launch: every promised feature that is still unbuilt becomes a promise. */
export function startingPromises(state: RunState): FeaturePromise[] {
  return promisedFeatures(state.concept)
    .filter((id) => findFeature(state, id)?.state === 'PLANNED')
    .map((featureId) => ({ featureId, since: 0 }))
}

/** Is this feature one the pitch promised? (Built or not.) */
export function isPromised(state: RunState, id: FeatureId): boolean {
  return promisedFeatures(state.concept).includes(id)
}

/** Promises that are still unbuilt and not cancelled. */
export function unresolvedPromises(state: RunState): FeatureId[] {
  const live = state.live
  if (!live) return []
  return live.promises
    .map((p) => p.featureId)
    .filter((id) => !live.cancelled.includes(id) && findFeature(state, id)?.state === 'PLANNED')
}

/** How many sprints one promise has been hurting for. */
export function promiseAge(state: RunState, id: FeatureId): number {
  const live = state.live
  const promise = live?.promises.find((p) => p.featureId === id)
  return live && promise ? Math.max(0, live.sprintsLive - promise.since) : 0
}

/** Legacy points lost to promises still unbuilt: each grows by 1 a sprint, up to a cap of 4. */
export function promisePenalty(state: RunState): number {
  return unresolvedPromises(state).reduce(
    (sum, id) => sum + Math.min(PROMISE_HURT_CAP, PROMISE_HURT_PER_SPRINT * promiseAge(state, id)),
    0,
  )
}

/** Permanent goodwill lost for promises that were formally cancelled. */
export function cancelPenalty(state: RunState): number {
  return CANCEL_PENALTY * (state.live?.cancelled.length ?? 0)
}

/** Why this promise cannot be cancelled right now, or null if it can. */
export function whyCannotCancel(state: RunState, id: FeatureId): string | null {
  if (state.phase !== 'live' || !state.live) return 'Only a live game has promises to cancel.'
  if (!unresolvedPromises(state).includes(id)) return 'That is not an open promise.'
  return null
}

/**
 * Formally cancel a promise. It stops hurting every sprint, but it costs permanent goodwill:
 * -2 legacy points and -10 hype, and the half-built work is shelved for good.
 */
export function cancelPromise(state: RunState, featureId: FeatureId, record = true): RunState {
  if (whyCannotCancel(state, featureId) !== null || !state.live) return state
  const feature = findFeature(state, featureId)!
  const next: RunState = {
    ...withFeature(state, { ...feature, progress: 0 }),
    hype: Math.max(0, state.hype - CANCEL_HYPE_PENALTY),
    live: { ...state.live, cancelled: [...state.live.cancelled, featureId] },
    // `record` is false when an event's choice does the cancelling: that choice is what gets recorded.
    history: record ? [...state.history, { kind: 'cancel', sprint: state.sprint, featureId }] : state.history,
  }
  return addLog(
    next,
    `${feature.name} is formally cancelled. Fans notice, and they remember (-${CANCEL_PENALTY} legacy, -${CANCEL_HYPE_PENALTY} hype).`,
    'warn',
  )
}

/** Reassure fans: the resentment clock on this promise starts again from zero. */
export function restartPromiseClock(state: RunState, featureId: FeatureId): RunState {
  const live = state.live
  if (!live) return state
  return {
    ...state,
    live: {
      ...live,
      promises: live.promises.map((p) => (p.featureId === featureId ? { ...p, since: live.sprintsLive } : p)),
    },
  }
}
