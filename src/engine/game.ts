import { FEATURE_DEFS } from '../content/features'
import { applyAction, isStuck } from './actions'
import { bugDrift } from './bugs'
import {
  BROKE_MORALE_PENALTY,
  BUGGY_MORALE_PENALTY,
  BUGGY_THRESHOLD,
  FULL_RUN,
  SHIP_UNLOCK_SPRINT,
  SLOTS_PER_SPRINT,
  START_RESOURCES,
} from './config'
import { sprintUpkeep } from './economy'
import { endLiveSprint, launchUpdates, liveSprintEndEffects, releaseUpdate, retireGame } from './live'
import { resolveEvent } from './liveEvents'
import { clampMorale, moraleTier } from './morale'
import { cancelPromise } from './promises'
import { computeReview } from './review'
import { getScope } from './scope'
import { addLog, plural } from './state'
import type {
  Action,
  Concept,
  Feature,
  FeatureId,
  HistoryEvent,
  RunConfig,
  RunState,
  SprintEndEffects,
  SprintEndNote,
} from './types'

/** Fresh features for a run: all six, or just the ones the config allows. */
export function createFeatures(only: readonly FeatureId[] | null = null): Feature[] {
  return FEATURE_DEFS.filter((def) => only === null || only.includes(def.id)).map((def) => ({
    ...def,
    state: 'PLANNED',
    progress: 0,
    quality: 0,
  }))
}

/** Start a fresh run. Same concept + seed + config always gives the same starting state. */
export function createRun(concept: Concept, seed: number, config: RunConfig = FULL_RUN): RunState {
  const clean: Concept = { ...concept, title: concept.title.trim(), idea: concept.idea.trim() }
  return addLog(
    {
      seed,
      config: { ...config },
      rng: seed >>> 0,
      concept: clean,
      phase: 'developing',
      sprint: 1,
      actionsLeft: SLOTS_PER_SPRINT,
      ...START_RESOURCES,
      features: createFeatures(config.featureIds),
      history: [],
      log: [],
      review: null,
      live: null,
      legacy: null,
    },
    `Development of ${clean.title} begins. ${config.totalSprints} sprints on the clock.`,
  )
}

/** The deadline sprint of development. A live game has no deadline. */
export function isFinalSprint(state: RunState): boolean {
  return state.phase === 'developing' && state.sprint >= state.config.totalSprints
}

/** Shipping is allowed from sprint 4 on, any time before the game has shipped. */
export function canShip(state: RunState): boolean {
  return state.phase === 'developing' && state.sprint >= SHIP_UNLOCK_SPRINT
}

/** What closing the current sprint will do. The UI previews this; endSprint applies it. */
export function sprintEndEffects(state: RunState): SprintEndEffects {
  if (state.phase === 'live') return liveSprintEndEffects(state)
  const { level } = getScope(state.features)
  const drift = bugDrift(level, moraleTier(state.morale))
  const upkeep = sprintUpkeep(level)
  const money = -upkeep
  const notes: SprintEndNote[] = [
    {
      text:
        level === 'LOW'
          ? `The studio spends ${upkeep}.`
          : `Upkeep is ${upkeep}: a ${level} scope game costs more to run.`,
      tone: level === 'LOW' ? 'neutral' : 'warn',
    },
  ]
  let morale = 0

  if (drift > 0) {
    notes.push({
      text: `Scope is ${level}: ${plural(drift, 'bug')} creep in on their own.`,
      tone: 'warn',
    })
  }
  if (state.bugs + drift >= BUGGY_THRESHOLD) {
    morale -= BUGGY_MORALE_PENALTY
    notes.push({ text: 'The team is demoralised by the bug count.', tone: 'bad' })
  }
  if (state.money + money <= 0) {
    morale -= BROKE_MORALE_PENALTY
    notes.push({ text: 'The studio is broke. Morale takes a hit.', tone: 'bad' })
  }
  return { money, bugs: drift, morale, notes }
}

function finishRun(state: RunState, forced: boolean): RunState {
  const shipped: RunState = { ...state, phase: 'shipped' }
  const review = computeReview(shipped, forced)
  return addLog(
    { ...shipped, review },
    forced
      ? `Deadline. ${state.concept.title} ships as it stands.`
      : `${state.concept.title} ships in sprint ${state.sprint}.`,
    'neutral',
  )
}

/** Release now. Only legal from sprint 4. */
export function shipGame(state: RunState): RunState {
  if (!canShip(state)) return state
  const event: HistoryEvent = { kind: 'ship', sprint: state.sprint }
  return finishRun({ ...state, history: [...state.history, event] }, false)
}

/**
 * Close the sprint once all three action slots are spent. Sprints 1-7 charge the
 * sprint-end costs and start the next sprint. Closing sprint 8 forces the release.
 */
export function endSprint(state: RunState): RunState {
  if (state.phase === 'live') return endLiveSprint(state)
  if (state.phase !== 'developing' || (state.actionsLeft > 0 && !isStuck(state))) return state

  const history: HistoryEvent[] = [...state.history, { kind: 'endSprint', sprint: state.sprint }]
  if (isFinalSprint(state)) return finishRun({ ...state, history }, true)

  const fx = sprintEndEffects(state)
  let next: RunState = {
    ...state,
    history,
    money: state.money + fx.money,
    bugs: state.bugs + fx.bugs,
    morale: clampMorale(state.morale + fx.morale),
  }
  for (const note of fx.notes) next = addLog(next, note.text, note.tone)
  return { ...next, sprint: state.sprint + 1, actionsLeft: SLOTS_PER_SPRINT }
}

/**
 * Re-run a recorded history from a fresh start. With an override, one recorded
 * action is swapped for a different one (used by the Turning Point analysis).
 * Returns null if any step becomes illegal under the change.
 */
export function replayHistory(
  start: Pick<RunState, 'concept' | 'seed' | 'config'>,
  history: readonly HistoryEvent[],
  override?: { index: number; action: Action },
): RunState | null {
  let state = createRun(start.concept, start.seed, start.config)
  for (let i = 0; i < history.length; i++) {
    const event = history[i]
    switch (event.kind) {
      case 'action': {
        const action = override && override.index === i ? override.action : event.action
        const result = applyAction(state, action)
        if (!result.ok) return null
        state = result.state
        break
      }
      case 'endSprint':
        state = endSprint(state)
        break
      case 'ship':
        state = shipGame(state)
        break
      // After launch. The same functions the UI calls, so a replay lands on exactly the same state.
      case 'launchUpdates':
        state = launchUpdates(state)
        break
      case 'release':
        state = releaseUpdate(state)
        break
      case 'cancel':
        state = cancelPromise(state, event.featureId)
        break
      case 'choice':
        state = resolveEvent(state, event.choiceId)
        break
      case 'retire':
        state = retireGame(state)
        break
    }
  }
  return state
}
