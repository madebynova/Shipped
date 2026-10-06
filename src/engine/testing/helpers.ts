// Small helpers shared by the engine tests.
import { applyAction, computeReview, createRun, endSprint, findLiveEvent, launchUpdates, resolveEvent } from '../index'
import type { Action, Concept, Feature, FeatureId, RunConfig, RunState } from '../index'
import { TEST_CONCEPT } from './bots'

export function freshRun(seed = 1, config?: RunConfig): RunState {
  return createRun(TEST_CONCEPT, seed, config)
}

/** Apply an action that must be legal. */
export function act(state: RunState, action: Action): RunState {
  const result = applyAction(state, action)
  if (!result.ok) throw new Error(`illegal action ${action.type}: ${result.reason}`)
  return result.state
}

export function build(state: RunState, featureId: FeatureId): RunState {
  return act(state, { type: 'BUILD', featureId })
}

export function polish(state: RunState, featureId: FeatureId): RunState {
  return act(state, { type: 'POLISH', featureId })
}

const IDLE_MOVES: Action[] = [
  { type: 'REST' },
  { type: 'HYPE' },
  { type: 'FIX' },
  { type: 'BUILD', featureId: 'story' },
  { type: 'BUILD', featureId: 'vehicles' },
  { type: 'BUILD', featureId: 'combat' },
]

/** Spend every remaining slot this sprint on the first legal low-impact move. */
export function spendSlots(state: RunState): RunState {
  let s = state
  while (s.actionsLeft > 0) {
    const move = IDLE_MOVES.map((a) => applyAction(s, a)).find((r) => r.ok)
    if (!move) throw new Error('no idle move available')
    s = move.state
  }
  return s
}

/** Spend the remaining slots, then close the sprint. */
export function idleSprint(state: RunState): RunState {
  return endSprint(spendSlots(state))
}

/** Patch a feature directly, for tests that need an exact situation. */
export function withFeature(
  state: RunState,
  id: FeatureId,
  patch: Partial<RunState['features'][number]>,
): RunState {
  return { ...state, features: state.features.map((f) => (f.id === id ? { ...f, ...patch } : f)) }
}

/** Recursively freeze so any accidental mutation throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

/* ------------------------------------------------------------------------------------------
   Live-phase helpers
   ------------------------------------------------------------------------------------------ */

export interface ShippedOptions {
  features?: Partial<Record<FeatureId, Partial<Feature>>>
  bugs?: number
  hype?: number
  money?: number
  morale?: number
  concept?: Concept
  seed?: number
  sprint?: number
  config?: RunConfig
}

/** A feature that is built and at a given quality (POLISHED from 70). */
export function built(quality: number, complexity?: number): Partial<Feature> {
  return {
    quality,
    state: quality >= 70 ? 'POLISHED' : 'PLAYABLE',
    progress: complexity ? complexity * 4 : 0,
  }
}

/**
 * A run that has just shipped, with exactly the situation a test needs. The review is the real review of
 * that situation, so launch scores, sales and promises all behave like they would in a played game.
 * Unlisted features are unbuilt.
 */
export function shippedRun(opts: ShippedOptions = {}): RunState {
  const base = createRun(opts.concept ?? TEST_CONCEPT, opts.seed ?? 1, opts.config)
  const features = base.features.map((f) => {
    const patch = opts.features?.[f.id]
    return patch ? { ...f, ...patch, progress: patch.progress ?? f.complexity * 4 } : f
  })
  const developing: RunState = {
    ...base,
    sprint: opts.sprint ?? 6,
    features,
    bugs: opts.bugs ?? 0,
    hype: opts.hype ?? 0,
    money: opts.money ?? 100,
    morale: opts.morale ?? 70,
  }
  return { ...developing, phase: 'shipped', review: computeReview({ ...developing, phase: 'shipped' }, false) }
}

/** A well-run game with four built features (Combat, Story, Crafting, Customization). */
export const FOUR_BUILT: ShippedOptions['features'] = {
  combat: built(72),
  story: built(72),
  crafting: built(72),
  customization: built(72),
}

/** shippedRun(), then LAUNCH UPDATES. */
export function goLive(opts: ShippedOptions = {}): RunState {
  const live = launchUpdates(shippedRun(opts))
  if (live.phase !== 'live') throw new Error('could not go live')
  return live
}

/** If an event is waiting, take the first choice the account can pay for. */
export function settle(state: RunState): RunState {
  const id = state.live?.pendingEvent
  if (!id) return state
  const event = findLiveEvent(id)!
  const choice = event.choices.find((c) => !c.cost || state.money >= c.cost)!
  return resolveEvent(state, choice.id)
}

/** Spend the remaining slots on idle moves, close the live sprint, and deal with any event that comes up. */
export function liveSprint(state: RunState): RunState {
  return settle(endSprint(spendSlots(settle(state))))
}
