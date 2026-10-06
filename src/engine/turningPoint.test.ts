import { describe, expect, it } from 'vitest'
import { analyzeTurningPoint, canShip, createRun, describeAction, replayHistory } from './index'
import type { DecisionTurningPoint, RunState, TurningPoint } from './index'
import type { Policy } from './testing/bots'
import { TEST_CONCEPT, balanced, greedyBuilder, hypeSpammer, playRun } from './testing/bots'
import { freshRun } from './testing/helpers'

const FOUR: Parameters<typeof balanced>[0] = { features: ['combat', 'story', 'crafting', 'customization'] }

/** Narrow to a specific decision, failing the test if the analysis only gave a plan-level note. */
function decision(tp: TurningPoint | null): DecisionTurningPoint {
  if (!tp || tp.kind === 'plan') throw new Error('expected a specific decision')
  return tp
}

function actionIndex(run: RunState, sprint: number, slot: number): number {
  return run.history.findIndex((e) => e.kind === 'action' && e.sprint === sprint && e.slot === slot)
}

describe('replay', () => {
  it('reproduces a finished run exactly from its history', () => {
    const run = playRun(balanced(FOUR), TEST_CONCEPT, 7)
    const replayed = replayHistory(run.concept, run.seed, run.history)
    expect(replayed).toEqual(run)
  })

  it('reproduces an early ship exactly', () => {
    const run = playRun(balanced({ ...FOUR, shipAt: 5 }), TEST_CONCEPT, 3)
    expect(run.review!.forced).toBe(false)
    expect(replayHistory(run.concept, run.seed, run.history)).toEqual(run)
  })

  it('returns null when a swapped action would make a later step illegal', () => {
    const run = playRun(balanced(FOUR), TEST_CONCEPT, 7)
    // Slot 1 of sprint 1 builds something; swapping it for HYPE breaks every later POLISH of it.
    const first = actionIndex(run, 1, 1)
    const broken = replayHistory(run.concept, run.seed, run.history, { index: first, action: { type: 'HYPE' } })
    const firstAction = run.history[first]
    expect(firstAction.kind === 'action' && firstAction.action.type).toBe('BUILD')
    expect(broken).toBeNull()
  })
})

describe('turning point', () => {
  it('needs a finished run', () => {
    expect(analyzeTurningPoint(freshRun())).toBeNull()
  })

  it('names a real decision in the required format', () => {
    const run = playRun(balanced(FOUR))
    const tp = decision(analyzeTurningPoint(run))
    expect(tp.headline).toMatch(/^Sprint \d: You chose .+ instead of .+\.$/)
    expect(tp.explanation.length).toBeGreaterThan(20)

    // The decision it points at really happened in that sprint and slot.
    const event = run.history[actionIndex(run, tp.sprint, tp.slot)]
    expect(event.kind).toBe('action')
    expect(event.kind === 'action' && event.action).toEqual(tp.chosen)
    expect(tp.headline).toContain(describeAction(tp.chosen, run.features))
    expect(tp.headline).toContain(describeAction(tp.alternative, run.features))
  })

  it('backs up its claim with an independent replay', () => {
    for (const run of [playRun(balanced(FOUR)), playRun(greedyBuilder(['combat', 'physics', 'vehicles', 'story']))]) {
      const tp = decision(analyzeTurningPoint(run))
      const index = actionIndex(run, tp.sprint, tp.slot)
      const replay = replayHistory(run.concept, run.seed, run.history, { index, action: tp.alternative })!
      expect(replay.review!.score).toBe(tp.alternativeScore)
      expect(tp.actualScore).toBe(run.review!.score)
    }
  })

  it('only calls it a mistake when the alternative clearly scored higher', () => {
    const run = playRun(hypeSpammer)
    const tp = decision(analyzeTurningPoint(run))
    expect(tp.kind).toBe('hurt')
    expect(tp.alternativeScore - tp.actualScore).toBeGreaterThanOrEqual(3)
  })

  it('celebrates a decision when no alternative would have done better', () => {
    // Search a few plausible runs for one with no clear regret; the contract is about its shape.
    const runs = [
      playRun(balanced(FOUR)),
      playRun(balanced({ features: ['combat', 'customization'] })),
      playRun(balanced({ features: ['combat', 'story', 'customization'], hypeSlots: 4 })),
    ]
    for (const run of runs) {
      const tp = decision(analyzeTurningPoint(run))
      if (tp.kind === 'helped') expect(tp.alternativeScore).toBeLessThan(tp.actualScore)
      else expect(tp.alternativeScore).toBeGreaterThan(tp.actualScore)
    }
  })

  it('admits when the plan, not one decision, was the problem', () => {
    // Nine HYPEs and a ship at sprint 4: nothing built, so no single swap can rescue a 0.
    const hypeOnly: Policy = (s) => (s.sprint >= 4 && canShip(s) ? 'ship' : { type: 'HYPE' })
    const run = playRun(hypeOnly)
    expect(run.features.every((f) => f.state === 'PLANNED')).toBe(true)
    const tp = analyzeTurningPoint(run)!
    expect(tp.kind).toBe('plan')
    expect(tp.explanation).toMatch(/BUILD/)
    expect(tp.actualScore).toBe(run.review!.score)
  })

  it('is deterministic', () => {
    const run = playRun(balanced(FOUR), TEST_CONCEPT, 11)
    expect(analyzeTurningPoint(run)).toEqual(analyzeTurningPoint(run))
  })

  it('does not touch the run it analyses', () => {
    const run = playRun(balanced(FOUR))
    const before = JSON.stringify(run)
    analyzeTurningPoint(run)
    expect(JSON.stringify(run)).toBe(before)
    expect(createRun(run.concept, run.seed).history).toEqual([])
  })
})

describe('describeAction', () => {
  it('names the feature for BUILD and POLISH only', () => {
    const features = freshRun().features
    expect(describeAction({ type: 'BUILD', featureId: 'combat' }, features)).toBe('BUILD Combat')
    expect(describeAction({ type: 'POLISH', featureId: 'story' }, features)).toBe('POLISH Story')
    expect(describeAction({ type: 'HYPE' }, features)).toBe('HYPE')
  })
})
