// Headless "players" used by the balance tests. They only talk to the public
// engine API, exactly like the UI does, so they double as a check that a whole
// run can be driven without React.
import { FULL_RUN, applyAction, canShip, createRun, endSprint, shipGame } from '../index'
import type { Action, Concept, FeatureId, RunConfig, RunState } from '../index'

export const TEST_CONCEPT: Concept = {
  title: 'Iron Pulse',
  idea: 'A brutal physics-driven hand-to-hand combat game where every hit matters.',
  genre: 'Action',
}

/** A policy looks at the state and returns the next action, or 'ship' to release now. */
export type Policy = (state: RunState) => Action | 'ship'

export function playRun(
  policy: Policy,
  concept: Concept = TEST_CONCEPT,
  seed = 1,
  config: RunConfig = FULL_RUN,
): RunState {
  let state = createRun(concept, seed, config)
  for (let guard = 0; guard < 200 && state.phase === 'developing'; guard++) {
    if (state.actionsLeft === 0) {
      state = endSprint(state)
      continue
    }
    const choice = policy(state)
    if (choice === 'ship') {
      if (!canShip(state)) throw new Error('policy tried to ship before sprint 4')
      state = shipGame(state)
      continue
    }
    const result = applyAction(state, choice)
    if (!result.ok) throw new Error(`policy chose an illegal action: ${choice.type} (${result.reason})`)
    state = result.state
  }
  return state
}

const byId = (state: RunState, id: FeatureId) => state.features.find((f) => f.id === id)!

/** First action from the list that is legal right now. */
export function firstLegal(state: RunState, candidates: Action[]): Action {
  for (const a of candidates) {
    const probe = applyAction(state, a)
    if (probe.ok) return a
  }
  throw new Error('no legal action')
}

export function weakestBuilt(state: RunState): FeatureId | undefined {
  return state.features
    .filter((f) => f.state !== 'PLANNED' && f.quality < 100)
    .sort((a, b) => a.quality - b.quality)[0]?.id
}

/** Keeps building the listed features in order, never fixes or rests. */
export function greedyBuilder(order: FeatureId[]): Policy {
  return (state) => {
    const next = order.map((id) => byId(state, id)).find((f) => f.state === 'PLANNED')
    if (next) return { type: 'BUILD', featureId: next.id }
    return firstLegal(state, [
      { type: 'BUILD', featureId: weakestBuilt(state) },
      { type: 'HYPE' },
    ])
  }
}

/** Always HYPE (then REST once hype is capped). Never builds anything. */
/** Builds the cheapest-to-start feature that exists in this run (any feature set). */
function anyBuild(state: RunState): Action[] {
  return [...state.features].reverse().map((f) => ({ type: 'BUILD' as const, featureId: f.id }))
}

export const hypeSpammer: Policy = (state) =>
  firstLegal(state, [{ type: 'HYPE' }, { type: 'REST' }, ...anyBuild(state)])

export const restOnly: Policy = (state) =>
  firstLegal(state, [{ type: 'REST' }, { type: 'HYPE' }, ...anyBuild(state)])

export interface BalancedOptions {
  features: FeatureId[]
  restBelow?: number
  fixAbove?: number
  polishTo?: number
  hypeSlots?: number
  shipAt?: number
}

/**
 * A reasonable human-ish plan: keep morale and bugs in check, build the chosen
 * features, polish them up, and spend leftover slots on hype.
 */
export function balanced(opts: BalancedOptions): Policy {
  const restBelow = opts.restBelow ?? 45
  const fixAbove = opts.fixAbove ?? 5
  const polishTo = opts.polishTo ?? 72
  const hypeSlots = opts.hypeSlots ?? 3
  return (state) => {
    if (opts.shipAt && state.sprint >= opts.shipAt && canShip(state)) return 'ship'
    if (state.morale < restBelow) return firstLegal(state, [{ type: 'REST' }, { type: 'HYPE' }])
    if (state.bugs > fixAbove) return firstLegal(state, [{ type: 'FIX' }, { type: 'HYPE' }])
    const next = opts.features.map((id) => byId(state, id)).find((f) => f.state === 'PLANNED')
    if (next) return { type: 'BUILD', featureId: next.id }
    const weak = state.features
      .filter((f) => opts.features.includes(f.id) && f.state !== 'PLANNED' && f.quality < polishTo)
      .sort((a, b) => a.quality - b.quality)[0]
    if (weak) return { type: 'POLISH', featureId: weak.id }
    const hypeCount = state.history.filter((e) => e.kind === 'action' && e.action.type === 'HYPE').length
    if (hypeCount < hypeSlots) return firstLegal(state, [{ type: 'HYPE' }, { type: 'FIX' }])
    return firstLegal(state, [
      { type: 'FIX' },
      { type: 'POLISH', featureId: weakestBuilt(state) },
      { type: 'REST' },
      { type: 'HYPE' },
    ])
  }
}
