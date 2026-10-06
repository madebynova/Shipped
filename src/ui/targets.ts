import { validateAction } from '../engine'
import type { ActionType, Feature, RunState } from '../engine'

/** Features an action (BUILD / POLISH) could currently target. */
export function targetsFor(run: RunState, type: ActionType): Feature[] {
  return run.features.filter((f) => validateAction(run, { type, featureId: f.id }) === null)
}
