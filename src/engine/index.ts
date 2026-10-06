// Public surface of the SHIPPED simulation. The UI imports from here only.
export * from './types'
export * from './config'
export { randomSeed } from './rng'
export { buildCost, getScope, scopeLoad, scopeLevelFor, SCOPE_LEVELS, SCOPE_HINT, SCOPE_EFFICIENCY, BUILD_POWER } from './scope'
export { moraleTier, moraleEfficiency } from './morale'
export { stability, bugsFromBuild, bugDrift, fixPower } from './bugs'
export type { Stability } from './bugs'
export { applyAction, validateAction, previewAction } from './actions'
export type { ActionPreview } from './actions'
export {
  createRun,
  createFeatures,
  canShip,
  isFinalSprint,
  shipGame,
  endSprint,
  sprintEndEffects,
  replayHistory,
} from './game'
export type { SprintEndEffects, SprintEndNote } from './game'
export { computeReview, bandFor, BAND_THRESHOLDS } from './review'
export { originalityScore } from './originality'
export { analyzeTurningPoint, describeAction } from './turningPoint'
export type { TurningPoint, DecisionTurningPoint, PlanTurningPoint } from './turningPoint'
