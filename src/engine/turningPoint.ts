import { applyAction, validateAction } from './actions'
import { createRun, endSprint, replayHistory, shipGame } from './game'
import type { Action, Feature, HistoryEvent, RunState } from './types'

// TURNING POINT (basic): find the one decision that most likely changed the score.
//
// For every action the player took, we replay the whole run with just that one
// action swapped for a sensible alternative and compare final scores. Swaps that
// would make a later action illegal (e.g. polishing a feature that never got
// built) are thrown away, so every comparison is a clean "what if I had done X".

/** One specific decision that moved the score, for better or worse. */
export interface DecisionTurningPoint {
  kind: 'hurt' | 'helped'
  sprint: number
  slot: number
  chosen: Action
  alternative: Action
  /** e.g. "Sprint 6: You chose HYPE instead of FIX." */
  headline: string
  explanation: string
  actualScore: number
  alternativeScore: number
}

/** No single decision explains the run: the plan itself was the problem. */
export interface PlanTurningPoint {
  kind: 'plan'
  headline: string
  explanation: string
  actualScore: number
}

export type TurningPoint = DecisionTurningPoint | PlanTurningPoint

/** A regret must be at least this many points to be called a mistake. */
const HURT_MIN = 3

interface Candidate {
  index: number
  sprint: number
  slot: number
  chosen: Action
  before: RunState
  alternative: Action
  altScore: number
}

export function describeAction(action: Action, features: readonly Feature[]): string {
  if (action.type === 'BUILD' || action.type === 'POLISH') {
    const name = features.find((f) => f.id === action.featureId)?.name ?? 'a feature'
    return `${action.type} ${name}`
  }
  return action.type
}

function alternativesFor(before: RunState, chosen: Action): Action[] {
  const alts: Action[] = []
  if (chosen.type !== 'FIX') alts.push({ type: 'FIX' })
  if (chosen.type !== 'HYPE') alts.push({ type: 'HYPE' })
  if (chosen.type !== 'REST') alts.push({ type: 'REST' })

  if (chosen.type !== 'POLISH') {
    const weakest = before.features
      .filter((f) => f.state !== 'PLANNED' && f.quality < 100)
      .sort((a, b) => a.quality - b.quality)[0]
    if (weakest) alts.push({ type: 'POLISH', featureId: weakest.id })
  }
  if (chosen.type !== 'BUILD') {
    const next = before.features
      .filter((f) => f.state === 'PLANNED')
      .sort((a, b) => b.progress - a.progress || a.complexity - b.complexity)[0]
    if (next) alts.push({ type: 'BUILD', featureId: next.id })
  }
  return alts.filter((a) => validateAction(before, a) === null)
}

/** Walk the recorded history and collect the state in front of every decision. */
function decisionPoints(final: RunState) {
  const points: { index: number; sprint: number; slot: number; chosen: Action; before: RunState }[] = []
  let state = createRun(final.concept, final.seed)
  final.history.forEach((event: HistoryEvent, index) => {
    if (event.kind === 'action') {
      points.push({ index, sprint: event.sprint, slot: event.slot, chosen: event.action, before: state })
      const result = applyAction(state, event.action)
      if (result.ok) state = result.state
    } else if (event.kind === 'endSprint') {
      state = endSprint(state)
    } else {
      state = shipGame(state)
    }
  })
  return points
}

function altLabel(action: Action, features: readonly Feature[]): string {
  return describeAction(action, features)
}

function featureName(action: Action, features: readonly Feature[]): string {
  return features.find((f) => f.id === action.featureId)?.name ?? 'that feature'
}

function hurtExplanation(c: Candidate, final: RunState, actual: number): string {
  const { chosen, alternative } = c
  const features = final.features
  const scoreLine = `Doing that instead would have scored ${c.altScore} instead of ${actual}.`

  if (chosen.type === 'HYPE' && alternative.type === 'FIX' && final.bugs > 0) {
    return `The extra exposure raised expectations, but the ${final.bugs} unresolved bugs hurt your final review. ${scoreLine}`
  }

  const chosenClause: Record<Action['type'], string> = {
    HYPE: 'The extra exposure raised expectations without improving the game.',
    BUILD: 'Pushing the build forward also added bugs and scope pressure.',
    POLISH: 'The refinement was real, but it was not what the build needed most.',
    FIX: 'The cleanup was real, but it was not what the build needed most.',
    REST: 'The break cost you a slot of progress.',
  }
  const altClause: Record<Action['type'], string> = {
    FIX:
      final.bugs > 0
        ? `Fixing would have cleared bugs that still hurt the shipped game (${final.bugs} left).`
        : 'Fixing sooner would have kept the team out of trouble.',
    POLISH: `Polishing ${featureName(alternative, features)} would have lifted the quality reviewers saw.`,
    BUILD: `Building ${featureName(alternative, features)} would have put more game in the final build.`,
    HYPE: 'More hype would have paid off: the finished game could carry the expectations.',
    REST: 'A rest would have kept the team sharper for the sprints that followed.',
  }
  return `${chosenClause[chosen.type]} ${altClause[alternative.type]} ${scoreLine}`
}

function helpedExplanation(c: Candidate, actual: number): string {
  const helped: Record<Action['type'], string> = {
    FIX: 'Fixing here kept the build stable where it counted.',
    POLISH: 'The polish paid off in the final review.',
    BUILD: 'That work put real game into the final build.',
    HYPE: 'The extra hype set expectations the finished game could meet.',
    REST: 'The rest kept the team sharp for the sprints that followed.',
  }
  return `${helped[c.chosen.type]} Choosing differently would have dropped the final score from ${actual} to ${c.altScore}.`
}

export function analyzeTurningPoint(final: RunState): TurningPoint | null {
  if (final.phase !== 'shipped' || !final.review) return null
  const actual = final.review.score

  // Gather every legal single-action swap and what it would have scored.
  const perDecision = decisionPoints(final).map((point) => {
    const candidates: Candidate[] = []
    for (const alternative of alternativesFor(point.before, point.chosen)) {
      const replayed = replayHistory(final.concept, final.seed, final.history, {
        index: point.index,
        action: alternative,
      })
      if (!replayed?.review) continue
      candidates.push({ ...point, alternative, altScore: replayed.review.score })
    }
    return candidates
  })

  // 1. The biggest regret: an alternative that would have scored clearly higher.
  let worst: Candidate | null = null
  for (const candidates of perDecision) {
    for (const c of candidates) {
      if (c.altScore - actual >= HURT_MIN && (!worst || c.altScore > worst.altScore)) worst = c
    }
  }
  if (worst) {
    return build('hurt', worst, final, actual, hurtExplanation(worst, final, actual))
  }

  // 2. No clear mistake: celebrate the decision that protected the score most.
  let best: Candidate | null = null
  for (const candidates of perDecision) {
    for (const c of candidates) {
      if (actual - c.altScore > 0 && (!best || c.altScore < best.altScore)) best = c
    }
  }
  if (best) return build('helped', best, final, actual, helpedExplanation(best, actual))

  // 3. Nothing a single swap could change. The only honest story is "you never built a game".
  if (final.features.every((f) => f.state === 'PLANNED')) {
    return {
      kind: 'plan',
      headline: 'No single decision saved this run.',
      explanation:
        'You shipped with nothing playable, so swapping any one action could not change the outcome. Hype, rest and fixes only matter once a game exists: start next run with BUILD.',
      actualScore: actual,
    }
  }
  return null
}

function build(
  kind: DecisionTurningPoint['kind'],
  c: Candidate,
  final: RunState,
  actual: number,
  explanation: string,
): DecisionTurningPoint {
  const features = final.features
  return {
    kind,
    sprint: c.sprint,
    slot: c.slot,
    chosen: c.chosen,
    alternative: c.alternative,
    headline: `Sprint ${c.sprint}: You chose ${describeAction(c.chosen, features)} instead of ${altLabel(c.alternative, features)}.`,
    explanation,
    actualScore: actual,
    alternativeScore: c.altScore,
  }
}
