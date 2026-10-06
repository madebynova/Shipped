import { describe, expect, it } from 'vitest'
import {
  FULL_RUN,
  TOTAL_SPRINTS,
  TUTORIAL_PASS_SCORE,
  TUTORIAL_RUN,
  analyzeTurningPoint,
  applyAction,
  canShip,
  createRun,
  endSprint,
  isFinalSprint,
  replayHistory,
  shipGame,
} from './index'
import type { Policy } from './testing/bots'
import { TEST_CONCEPT, balanced, greedyBuilder, hypeSpammer, playRun } from './testing/bots'
import { act, idleSprint, spendSlots } from './testing/helpers'

const tutorialRun = (seed = 1) => createRun(TEST_CONCEPT, seed, TUTORIAL_RUN)

/** What a newcomer might do on their own: build everything, polish, never fix or rest. */
const naive: Policy = (s) => {
  const next = s.features.find((f) => f.state === 'PLANNED')
  if (next) return { type: 'BUILD', featureId: next.id }
  const weak = [...s.features].filter((f) => f.quality < 100).sort((a, b) => a.quality - b.quality)[0]
  return weak ? { type: 'POLISH', featureId: weak.id } : { type: 'HYPE' }
}

describe('run configuration', () => {
  it('defaults to the full game: 8 sprints and all six features', () => {
    const s = createRun(TEST_CONCEPT, 1)
    expect(s.config).toEqual(FULL_RUN)
    expect(s.config.totalSprints).toBe(TOTAL_SPRINTS)
    expect(s.features).toHaveLength(6)
  })

  it('gives the tutorial 6 sprints and 4 teaching cards', () => {
    const s = tutorialRun()
    expect(s.config.kind).toBe('tutorial')
    expect(s.config.totalSprints).toBe(6)
    expect(s.features.map((f) => f.id)).toEqual(['combat', 'story', 'crafting', 'customization'])
  })

  it('keeps resources and rules the same as the full game apart from the config', () => {
    const t = tutorialRun()
    const f = createRun(TEST_CONCEPT, 1)
    expect({ money: t.money, morale: t.morale, hype: t.hype, bugs: t.bugs }).toEqual({
      money: f.money,
      morale: f.morale,
      hype: f.hype,
      bugs: f.bugs,
    })
    expect(t.actionsLeft).toBe(f.actionsLeft)
  })

  it('stores a copy of the config, so no run can change the shared template', () => {
    const s = tutorialRun()
    expect(s.config).not.toBe(TUTORIAL_RUN)
    s.config.totalSprints = 99
    expect(TUTORIAL_RUN.totalSprints).toBe(6)
  })
})

describe('the tutorial deadline', () => {
  it('forces the ship when sprint 6 ends, not sprint 8', () => {
    let s = tutorialRun()
    for (let i = 0; i < 5; i++) s = idleSprint(s)
    expect(s.sprint).toBe(6)
    expect(isFinalSprint(s)).toBe(true)
    expect(s.phase).toBe('developing')
    s = spendSlots(s)
    const shipped = endSprint(s)
    expect(shipped.phase).toBe('shipped')
    expect(shipped.review!.forced).toBe(true)
    expect(shipped.review!.shippedSprint).toBe(6)
    // the deadline line is low priority, but it must never claim the wrong deadline
    expect(shipped.review!.verdict.join(' ')).not.toContain('sprint-8')
  })

  it('still unlocks shipping in sprint 4', () => {
    let s = tutorialRun()
    for (let sprint = 1; sprint <= 3; sprint++) {
      expect(canShip(s)).toBe(false)
      s = idleSprint(s)
    }
    expect(canShip(s)).toBe(true)
    expect(shipGame(s).phase).toBe('shipped')
  })

  it('refuses to build a feature that is not in the tutorial', () => {
    expect(applyAction(tutorialRun(), { type: 'BUILD', featureId: 'vehicles' }).ok).toBe(false)
    expect(applyAction(tutorialRun(), { type: 'BUILD', featureId: 'combat' }).ok).toBe(true)
  })
})

describe('the tutorial is hard to fail and easy to pass', () => {
  it('passes with a sensible plan', () => {
    const r = playRun(balanced({ features: ['combat', 'story', 'crafting', 'customization'] }), TEST_CONCEPT, 1, TUTORIAL_RUN).review!
    expect(r.score).toBeGreaterThanOrEqual(TUTORIAL_PASS_SCORE + 10)
  })

  it('passes even for a newcomer who ignores bugs, morale and hype', () => {
    const r = playRun(naive, TEST_CONCEPT, 1, TUTORIAL_RUN).review!
    expect(r.score).toBeGreaterThanOrEqual(TUTORIAL_PASS_SCORE)
  })

  it('fails only when the player ignores the game entirely', () => {
    const hypeOnly = playRun(hypeSpammer, TEST_CONCEPT, 1, TUTORIAL_RUN).review!
    expect(hypeOnly.score).toBeLessThan(TUTORIAL_PASS_SCORE)
    const bugFactory = playRun(greedyBuilder(['customization', 'story', 'crafting', 'combat']), TEST_CONCEPT, 1, TUTORIAL_RUN).review!
    expect(bugFactory.score).toBeLessThan(TUTORIAL_PASS_SCORE)
  })

  it('never runs out of money on the way', () => {
    const run = playRun(naive, TEST_CONCEPT, 1, TUTORIAL_RUN)
    expect(run.money).toBeGreaterThan(0)
  })
})

describe('replay and turning point keep working with a config', () => {
  it('replays a tutorial run exactly', () => {
    const run = playRun(naive, TEST_CONCEPT, 4, TUTORIAL_RUN)
    expect(replayHistory(run, run.history)).toEqual(run)
  })

  it('analyses a tutorial run without leaving it', () => {
    const run = playRun(naive, TEST_CONCEPT, 4, TUTORIAL_RUN)
    const tp = analyzeTurningPoint(run)
    expect(tp).not.toBeNull()
    expect(tp!.headline.length).toBeGreaterThan(5)
  })

  it('a swapped action cannot reach outside the tutorial feature set', () => {
    let s = tutorialRun()
    s = act(s, { type: 'BUILD', featureId: 'combat' })
    expect(s.features.some((f) => f.id === 'vehicles')).toBe(false)
  })
})
