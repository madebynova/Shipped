// Public surface of the SHIPPED simulation. The UI imports from here only.
export * from './types'
export * from './config'
export { randomSeed } from './rng'
export {
  sprintUpkeep,
  BASE_UPKEEP,
  SCOPE_UPKEEP,
  liveUpkeep,
  LIVE_BASE_UPKEEP,
  LIVE_SCOPE_UPKEEP,
  firstWeekSales,
  startingSales,
  salesDecay,
  incomeFor,
  fadeHype,
  releaseSpike,
  runwayFor,
} from './economy'
export { buildCost, getScope, scopeLoad, scopeLevelFor, SCOPE_LEVELS, SCOPE_HINT, SCOPE_EFFICIENCY, BUILD_POWER } from './scope'
export { moraleTier, moraleEfficiency } from './morale'
export { stability, bugsFromBuild, bugDrift, fixPower } from './bugs'
export type { Stability } from './bugs'
export { applyAction, validateAction, previewAction, isStuck } from './actions'
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
export { computeReview, bandFor, BAND_THRESHOLDS } from './review'
export { originalityScore } from './originality'
export { analyzeTurningPoint, describeAction } from './turningPoint'
export type { TurningPoint, DecisionTurningPoint, PlanTurningPoint } from './turningPoint'

// After launch: live updates, legacy score, promises, events, patch notes.
export {
  launchUpdates,
  retireGame,
  releaseUpdate,
  previewRelease,
  whyCannotRelease,
  whyCannotLaunchUpdates,
  isUpdateWindowOpen,
  liveRunway,
  liveSprintNumber,
  openingAccount,
} from './live'
export type { ReleasePreview } from './live'
export { computeLegacy, isComplete, recoveryCredit } from './legacy'
export {
  promisedFeatures,
  unresolvedPromises,
  promiseAge,
  promisePenalty,
  cancelPromise,
  whyCannotCancel,
  isPromised,
} from './promises'
export { LIVE_EVENTS, findLiveEvent, resolveEvent, whyCannotChoose } from './liveEvents'
export type { LiveEventDef, LiveEventChoice } from './liveEvents'
export { describeChanges, legacyVerdict, joinNames } from './patchNotes'
