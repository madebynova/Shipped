// Core types for the SHIPPED simulation. Nothing in src/engine may import React.

export type Genre = 'Action' | 'RPG' | 'Racing' | 'Survival' | 'Strategy' | 'Simulation'

export type FeatureId =
  | 'combat'
  | 'story'
  | 'crafting'
  | 'physics'
  | 'vehicles'
  | 'customization'

export type FeatureState = 'PLANNED' | 'PLAYABLE' | 'POLISHED'
export type ActionType = 'BUILD' | 'POLISH' | 'FIX' | 'HYPE' | 'REST'
export type ScopeLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type MoraleTier = 'FOCUSED' | 'TIRED' | 'BURNED OUT'
export type ReviewBand =
  | 'MASTERPIECE'
  | 'GREAT'
  | 'SOLID'
  | 'ROUGH'
  | 'DISASTER'
  | 'LEGENDARY FAILURE'

/** What kind of run this is. The tutorial is a short, simplified run. */
export type RunKind = 'full' | 'tutorial'

/** The rules of a run that differ between the full game and the tutorial. */
export interface RunConfig {
  kind: RunKind
  /** Sprints before shipping is forced. */
  totalSprints: number
  /** Which features exist in this run, or null for all of them. */
  featureIds: readonly FeatureId[] | null
}

export interface Concept {
  title: string
  idea: string
  genre: Genre
}

/** Static design data for a feature (content/features.ts). */
export interface FeatureDef {
  id: FeatureId
  name: string
  description: string
  /** 1-3. Drives build cost and scope. */
  complexity: number
  /** How much this feature contributes to the GAMEPLAY review score. */
  gameplayWeight: number
  /** How much this feature contributes to the CONTENT review score. */
  contentWeight: number
}

/** A feature inside a run: static data plus mutable-by-replacement run state. */
export interface Feature extends FeatureDef {
  state: FeatureState
  /** Build points invested so far. Equals buildCost once the feature is playable. */
  progress: number
  /** 0-100. Only meaningful once the feature is PLAYABLE or better. */
  quality: number
}

export interface Action {
  type: ActionType
  /** Required for BUILD and POLISH. */
  featureId?: FeatureId
}

export type HistoryEvent =
  | { kind: 'action'; sprint: number; slot: number; action: Action }
  | { kind: 'endSprint'; sprint: number }
  | { kind: 'ship'; sprint: number }

export type LogTone = 'good' | 'bad' | 'warn' | 'neutral'

export interface LogEntry {
  id: number
  sprint: number
  text: string
  tone: LogTone
}

export interface Review {
  score: number
  band: ReviewBand
  gameplay: number
  content: number
  polish: number
  originality: number
  /** Score before the hype modifier. */
  baseScore: number
  /** Signed points added/removed because of hype expectations. */
  hypeModifier: number
  /** The quality the audience expects, given the hype generated. */
  hypeBar: number
  /** Sentences describing what actually happened in this run. */
  verdict: string[]
  shippedSprint: number
  /** True when the sprint-8 deadline forced the release. */
  forced: boolean
}

export type Phase = 'developing' | 'shipped'

export interface RunState {
  seed: number
  config: RunConfig
  /** Internal RNG state. Only used for flavour text; never for scores. */
  rng: number
  concept: Concept
  phase: Phase
  /** 1..config.totalSprints */
  sprint: number
  actionsLeft: number
  money: number
  morale: number
  hype: number
  bugs: number
  features: Feature[]
  history: HistoryEvent[]
  log: LogEntry[]
  review: Review | null
}

export interface ActionResult {
  ok: boolean
  /** The new state, or the unchanged input state when ok is false. */
  state: RunState
  reason?: string
}

export interface ResourceDeltas {
  money: number
  morale: number
  hype: number
  bugs: number
}
