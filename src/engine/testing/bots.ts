// Headless "players" used by the balance tests. They only talk to the public
// engine API, exactly like the UI does, so they double as a check that a whole
// run can be driven without React.
import {
  FULL_RUN,
  applyAction,
  canShip,
  cancelPromise,
  computeLegacy,
  createRun,
  endSprint,
  findLiveEvent,
  getScope,
  isUpdateWindowOpen,
  launchUpdates,
  moraleTier,
  previewRelease,
  releaseUpdate,
  resolveEvent,
  retireGame,
  shipGame,
  unresolvedPromises,
} from '../index'
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

/* ------------------------------------------------------------------------------------------
   Live updates (after launch). The same idea as above: a policy looks at the state and picks a
   move. These talk to the public engine API only, exactly like the UI.
   ------------------------------------------------------------------------------------------ */

export type LiveMove = Action | 'release' | 'retire' | { cancel: FeatureId }
export type LivePolicy = (state: RunState) => LiveMove
/** Picks the id of a choice for the event that is waiting. */
export type EventPolicy = (state: RunState) => string

/** The first choice of the pending event that the account can pay for. */
export const firstAffordableChoice: EventPolicy = (state) => {
  const event = findLiveEvent(state.live?.pendingEvent ?? null)
  if (!event) throw new Error('no event is pending')
  const choice = event.choices.find((c) => !c.cost || state.money >= c.cost)
  if (!choice) throw new Error('no affordable choice')
  return choice.id
}

/** What a thoughtful player would usually pick: helpful choices when the money is there, cheap ones when it is not. */
export const sensibleChoice: EventPolicy = (state) => {
  const rich = state.money >= 150
  const pick: Record<string, string> = {
    modders: 'embrace',
    streamer: rich ? 'sponsor' : 'thanks',
    demand: 'reassure',
    sale: state.money < 120 ? 'join' : 'hold',
    rival: rich ? 'outshine' : 'hold',
    burnout: state.money >= 80 ? 'retreat' : 'push',
    rereview: 'shout',
    driver: state.money >= 80 ? 'hotfix' : 'wait',
  }
  const wanted = pick[state.live?.pendingEvent ?? '']
  const event = findLiveEvent(state.live?.pendingEvent ?? null)
  const choice = event?.choices.find((c) => c.id === wanted && (!c.cost || state.money >= c.cost))
  return choice ? choice.id : firstAffordableChoice(state)
}

/**
 * Take a shipped run through LAUNCH UPDATES and play it until it is retired (by the policy, or because the
 * money ran out). Events are decided by `pick`. `maxLiveSprints` is a safety net so a policy that never
 * retires still ends.
 */
export function playLive(
  shipped: RunState,
  policy: LivePolicy,
  pick: EventPolicy = sensibleChoice,
  maxLiveSprints = 60,
): RunState {
  let state = launchUpdates(shipped)
  if (state.phase !== 'live') throw new Error('could not launch updates')
  for (let guard = 0; guard < 3000 && state.phase === 'live'; guard++) {
    const live = state.live!
    if (live.pendingEvent) {
      const next = resolveEvent(state, pick(state))
      if (next === state) throw new Error(`illegal event choice for ${live.pendingEvent}`)
      state = next
      continue
    }
    if (state.actionsLeft === 0) {
      state = state.sprint - live.launchSprint >= maxLiveSprints ? retireGame(state) : endSprint(state)
      continue
    }
    const move = policy(state)
    if (move === 'retire') {
      state = retireGame(state)
    } else if (move === 'release') {
      const next = releaseUpdate(state)
      if (next === state) throw new Error('the policy tried an illegal release')
      state = next
    } else if ('cancel' in move) {
      const next = cancelPromise(state, move.cancel)
      if (next === state) throw new Error('the policy tried an illegal cancel')
      state = next
    } else {
      const result = applyAction(state, move)
      if (!result.ok) throw new Error(`live policy chose an illegal action: ${move.type} (${result.reason})`)
      state = result.state
    }
  }
  if (state.phase === 'live') throw new Error('the live run did not end')
  return state
}

/** Rests (or hypes) every slot and never releases. Shows how long the money lasts when nothing is done. */
export const idleLive: LivePolicy = (state) =>
  firstLegal(state, [{ type: 'REST' }, { type: 'HYPE' }, { type: 'FIX' }, ...anyBuild(state)])

export interface SmartLiveOptions {
  /** Retire after this many live sprints even if there is more to do. */
  retireAt?: number
  /** Retire the moment the game is COMPLETE. */
  retireWhenComplete?: boolean
  /** Quality each built feature is polished up to. */
  polishTo?: number
  /** Build promised features. When false (or when building one would push scope to CRITICAL) they are cancelled early. */
  keepPromises?: boolean
  /** Release an update as soon as the legacy score would gain this many points. */
  releaseGain?: number
}

/** First action from the list that is legal right now, or null. */
function firstLegalOrNull(state: RunState, candidates: Action[]): Action | null {
  for (const a of candidates) if (applyAction(state, a).ok) return a
  return null
}

/**
 * A sensible live player: keep the team rested, squash bugs, finish the promised features if the game can take
 * them, polish what is weakest, release an update when the window opens or when there is a lot to show, and
 * retire when there is nothing left worth doing (after one last bug sweep).
 */
export function smartLive(opts: SmartLiveOptions = {}): LivePolicy {
  const polishTo = opts.polishTo ?? 88
  const retireAt = opts.retireAt ?? 14
  const releaseGain = opts.releaseGain ?? 5
  const keep = opts.keepPromises ?? true

  /** One last bug sweep, then retire. (Bugs creep in at the end of every sprint, so cleaning first matters.) */
  const sweepThenRetire = (state: RunState): LiveMove => {
    const sweep = state.bugs > 0 ? firstLegalOrNull(state, [{ type: 'FIX' }]) : null
    return sweep ?? 'retire'
  }

  return (state) => {
    const live = state.live!
    const liveSprint = state.sprint - live.launchSprint
    const legacy = computeLegacy(state)
    if ((opts.retireWhenComplete ?? true) && legacy.complete) return 'retire'
    if (liveSprint > retireAt) return sweepThenRetire(state)

    const preview = previewRelease(state)
    const gain = preview.legacyAfter - preview.legacyBefore
    if (preview.ok && gain >= 1 && (isUpdateWindowOpen(live) || gain >= releaseGain)) return 'release'

    if (state.morale < 40) return firstLegalOrNull(state, [{ type: 'REST' }]) ?? sweepThenRetire(state)
    if (state.bugs >= 3) return firstLegalOrNull(state, [{ type: 'FIX' }]) ?? sweepThenRetire(state)

    // Promises: build one if the game can take it, otherwise cancel it now, while that is cheap.
    const open = unresolvedPromises(state)
    if (open.length > 0) {
      const id = open[0]
      const levelWhenBuilt = getScope(state.features.map((f) => (f.id === id ? { ...f, state: 'PLAYABLE' as const } : f))).level
      if (keep && levelWhenBuilt !== 'CRITICAL') {
        const build = firstLegalOrNull(state, [{ type: 'BUILD', featureId: id }])
        if (build && moraleTier(state.morale) !== 'BURNED OUT') return build
      } else {
        return { cancel: id }
      }
    }

    const weak = state.features
      .filter((f) => f.state !== 'PLANNED' && f.quality < polishTo)
      .sort((a, b) => a.quality - b.quality)[0]
    if (weak) return { type: 'POLISH', featureId: weak.id }
    if (state.bugs > 0) return firstLegalOrNull(state, [{ type: 'FIX' }]) ?? sweepThenRetire(state)

    // Nothing left to improve: sell the next update with a little buzz, or call it a day.
    if (preview.ok && !isUpdateWindowOpen(live) && gain >= 1) return firstLegalOrNull(state, [{ type: 'HYPE' }]) ?? 'retire'
    return sweepThenRetire(state)
  }
}
