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
  /**
   * The 2-3 feature cards the pitch is built around (set by the concept gallery). They are what the
   * game "promises": a seed feature that is missing at launch becomes a promise to finish later.
   * A concept written by hand has none, and falls back to its genre's signature features.
   */
  seedFeatures?: readonly FeatureId[]
  /** A short phrase for the feeling the game promises ("Cozy dread"). Flavour text only. */
  vision?: string
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
  // After launch (live updates). Recorded so a whole run can still be replayed from its history.
  | { kind: 'launchUpdates'; sprint: number }
  | { kind: 'release'; sprint: number }
  | { kind: 'cancel'; sprint: number; featureId: FeatureId }
  | { kind: 'choice'; sprint: number; eventId: string; choiceId: string }
  | { kind: 'retire'; sprint: number }

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
  /** What the first week of sales earned, and how it was worked out (see economy.ts). */
  sales: SalesBreakdown
}

/** First-week sales revenue = base (from the score) x hype multiplier x genre market multiplier. */
export interface SalesBreakdown {
  /** Money earned from the review score alone. */
  base: number
  /** 1 + hype/100: loud games sell more copies in week one, good or not. */
  hypeMultiplier: number
  /** Some genres have bigger audiences than others. */
  marketMultiplier: number
  /** base x hypeMultiplier x marketMultiplier, rounded. */
  total: number
}

/**
 * developing: pre-launch sprints.
 * shipped:    the game just launched and the review is showing. The player now picks LAUNCH UPDATES
 *             or RETIRE GAME (the tutorial can only retire).
 * live:       post-launch sprints. Same loop (3 slots, 5 actions), but sales pay for the team.
 * retired:    the run is over and the final legacy card is written.
 */
export type Phase = 'developing' | 'shipped' | 'live' | 'retired'

/** A feature the pitch promised that was not in the build at launch. */
export interface FeaturePromise {
  featureId: FeatureId
  /** `sprintsLive` when the clock on this promise started (restarted when you reassure fans). */
  since: number
}

/** What the game looked like at the last release, so the next release can say what changed. */
export interface LiveSnapshot {
  features: { id: FeatureId; state: FeatureState; quality: number }[]
  bugs: number
  cancelled: number
}

/** One published update: the patch notes the player reads and the money it brought in. */
export interface Release {
  /** "v1.2" */
  version: string
  /** Which live sprint it went out in (1 = the first sprint after launch). */
  liveSprint: number
  /** A one-line summary: "polished Vehicles, fixed the co-op crash". */
  summary: string
  notes: string[]
  /** A short community reaction. */
  reaction: string
  legacyBefore: number
  legacyAfter: number
  /** Extra sales per sprint this release added. */
  spike: number
  /** Released before the update window opened, so the spike was smaller. */
  early: boolean
}

/** Everything that only exists after LAUNCH UPDATES. `null` on RunState before that. */
export interface LiveState {
  /** The review score at launch. Frozen: it is the first impression and never changes. */
  launchScore: number
  /** The sprint number the game shipped in. Live sprints are numbered after it. */
  launchSprint: number
  /** Releases so far; the game's version is v1.<minor>. */
  minor: number
  /** Live sprints completed so far. */
  sprintsLive: number
  sprintsSinceRelease: number
  /** Sales income expected when the current sprint closes. It decays every sprint. */
  sales: number
  /** Every dollar the game has earned since launch, first week included. */
  totalSales: number
  promises: FeaturePromise[]
  /** Promises formally cancelled. Each one costs permanent goodwill. */
  cancelled: FeatureId[]
  /** Added to ORIGINALITY (embracing the modders' creation, for example). */
  originalityBonus: number
  /** The account will not cover the next sprint. If it still won't at the next close, the studio closes. */
  warned: boolean
  /** The id of an event waiting for the player's decision, or null. */
  pendingEvent: string | null
  /** Events seen, with the live sprint they happened in. Used so events do not repeat too soon. */
  eventHistory: { id: string; sprint: number }[]
  /** One-liners from events ("kept the modders' wall-jump"), printed in the next patch notes. */
  pendingNotes: string[]
  snapshot: LiveSnapshot
  /** Legacy score when the last release (or the launch) went out. */
  legacyAtRelease: number
  releases: Release[]
}

export type EndReason = 'retired' | 'broke'

/** Why the legacy score is what it is. All numbers are points; penalties are positive numbers. */
export interface LegacyBreakdown {
  /** The review formula re-run on the game as it stands now (hype modifier included). */
  review: number
  /** Promises still unbuilt, each hurting a little more every sprint. */
  promisePenalty: number
  /** Permanent goodwill lost for formally cancelling promises. */
  cancelPenalty: number
  /** Improvement that skeptical players refuse to credit after a rough launch (launch under 60). */
  skepticism: number
  /** The COMPLETE stamp's reward. */
  completeBonus: number
  complete: boolean
  /** Unbuilt promises right now. */
  unresolved: FeatureId[]
}

/** The score a game has *now*, plus the arithmetic behind it. */
export interface LegacyScore extends LegacyBreakdown {
  score: number
  band: ReviewBand
}

/** The final card, written when a game is retired. */
export interface Legacy extends LegacyScore {
  launchScore: number
  launchBand: ReviewBand
  reason: EndReason
  liveSprints: number
  releases: number
  totalSales: number
}

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
  /** Post-launch state. Null until the player chooses LAUNCH UPDATES. */
  live: LiveState | null
  /** The final card. Null until the game is retired. */
  legacy: Legacy | null
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

export interface SprintEndNote {
  text: string
  tone: LogTone
}

/** What closing the current sprint will do. The UI previews this; endSprint applies it. */
export interface SprintEndEffects {
  /** Net change to money: before launch minus upkeep, after launch sales minus upkeep. */
  money: number
  bugs: number
  morale: number
  notes: SprintEndNote[]
  /** Live sprints only: what sales bring in, and what the team costs. */
  income?: number
  upkeep?: number
}
