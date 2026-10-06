// Small helpers shared by the engine tests.
import { applyAction, createRun, endSprint } from '../index'
import type { Action, FeatureId, RunConfig, RunState } from '../index'
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
