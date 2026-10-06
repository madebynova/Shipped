import { pickOne } from './rng'
import type { Feature, FeatureId, LogTone, RunState } from './types'

export function findFeature(state: RunState, id: FeatureId | undefined): Feature | undefined {
  return id ? state.features.find((f) => f.id === id) : undefined
}

/** Replace one feature immutably. */
export function withFeature(state: RunState, updated: Feature): RunState {
  return { ...state, features: state.features.map((f) => (f.id === updated.id ? updated : f)) }
}

export function addLog(state: RunState, text: string, tone: LogTone = 'neutral'): RunState {
  const lastId = state.log.length > 0 ? state.log[state.log.length - 1].id : 0
  return {
    ...state,
    log: [...state.log, { id: lastId + 1, sprint: state.sprint, text, tone }],
  }
}

/** Log one of several equivalent lines, chosen with the run's seeded RNG. */
export function addFlavorLog(state: RunState, variants: readonly string[], tone: LogTone): RunState {
  const { value, state: rng } = pickOne(state.rng, variants)
  return addLog({ ...state, rng }, value, tone)
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}
