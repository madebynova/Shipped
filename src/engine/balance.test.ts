// These tests pin down the design intent found while tuning with headless bots.
// If you rebalance and one fails, decide whether the *design* changed, not just the number.
import { describe, expect, it } from 'vitest'
import { applyAction, canShip, computeReview, createRun, endSprint, sprintUpkeep } from './index'
import type { Policy } from './testing/bots'
import { TEST_CONCEPT, balanced, greedyBuilder, hypeSpammer, playRun, restOnly } from './testing/bots'

const FOUR: Parameters<typeof balanced>[0] = { features: ['combat', 'story', 'crafting', 'customization'] }
const EVERYTHING = ['customization', 'story', 'crafting', 'combat', 'physics', 'vehicles'] as const

const shipAtStartOf = (inner: Policy, sprint: number): Policy => (s) =>
  s.sprint >= sprint && canShip(s) ? 'ship' : inner(s)

describe('a whole run can be played headlessly', () => {
  it('completes, ships by sprint 8 and produces a valid review', () => {
    const run = playRun(balanced(FOUR))
    expect(run.phase).toBe('shipped')
    expect(run.sprint).toBeLessThanOrEqual(8)
    expect(run.review!.score).toBeGreaterThanOrEqual(0)
    expect(run.review!.score).toBeLessThanOrEqual(100)
  })

  it('gives identical results for identical play', () => {
    expect(playRun(balanced(FOUR), TEST_CONCEPT, 5)).toEqual(playRun(balanced(FOUR), TEST_CONCEPT, 5))
  })

  it('scores do not depend on the seed (it only varies flavour text)', () => {
    const scores = [1, 2, 3, 4, 5].map((seed) => playRun(balanced(FOUR), TEST_CONCEPT, seed).review!.score)
    expect(new Set(scores).size).toBe(1)
  })

  it('re-computing the review of a finished run gives the same review', () => {
    const run = playRun(balanced(FOUR))
    expect(computeReview(run, run.review!.forced)).toEqual(run.review)
  })
})

describe('the review rewards good decisions and punishes bad ones', () => {
  it('turns hype-only play into a legendary failure', () => {
    const r = playRun(hypeSpammer).review!
    expect(r.band).toBe('LEGENDARY FAILURE')
    expect(r.hypeModifier).toBeLessThan(0)
  })

  it('does the same for a team that only rests', () => {
    expect(playRun(restOnly).review!.score).toBeLessThan(25)
  })

  it('punishes building everything with no fixing or rest', () => {
    const r = playRun(greedyBuilder([...EVERYTHING])).review!
    expect(r.score).toBeLessThan(45)
    expect(r.band).toBe('DISASTER')
  })

  it('lets a disciplined, right-sized game reach SOLID or better', () => {
    expect(playRun(balanced(FOUR)).review!.score).toBeGreaterThanOrEqual(60)
    expect(playRun(balanced({ features: ['combat', 'story', 'customization'] })).review!.score).toBeGreaterThanOrEqual(60)
  })

  it('beats the reckless approach by a wide margin', () => {
    const careful = playRun(balanced(FOUR)).review!.score
    const reckless = playRun(greedyBuilder([...EVERYTHING])).review!.score
    expect(careful - reckless).toBeGreaterThanOrEqual(25)
  })

  it('makes a lean, polished game competitive with a wide, rough one', () => {
    const lean = playRun(balanced({ features: ['combat', 'customization'] })).review!.score
    const wide = playRun(balanced({ features: ['combat', 'story', 'crafting', 'customization', 'physics'] })).review!.score
    expect(lean).toBeGreaterThanOrEqual(wide - 3)
  })

  it('rewards a right-sized game over an over-reaching one', () => {
    const rightSized = playRun(balanced(FOUR)).review!.score
    const overReaching = playRun(
      balanced({ features: ['combat', 'story', 'crafting', 'customization', 'physics', 'vehicles'] }),
    ).review!.score
    expect(rightSized).toBeGreaterThan(overReaching + 5)
  })
})

describe('money is a real decision, not a wall', () => {
  /** Money after each sprint close (sprint 8 ships without one). */
  function moneyAfterEachClose(policy: Policy): number[] {
    const out: number[] = []
    let state = createRun(TEST_CONCEPT, 1)
    for (let guard = 0; guard < 300 && state.phase === 'developing'; guard++) {
      if (state.actionsLeft === 0) {
        state = endSprint(state)
        if (state.phase === 'developing') out.push(state.money)
        continue
      }
      const choice = policy(state)
      if (choice === 'ship') break
      state = applyAction(state, choice).state
    }
    return out
  }

  it('starts with $500', () => {
    expect(createRun(TEST_CONCEPT, 1).money).toBe(500)
  })

  it('lets a disciplined run reach the deadline with cash to spare', () => {
    const money = moneyAfterEachClose(balanced(FOUR))
    expect(money).toHaveLength(7) // sprints 1-7 close; sprint 8 ships without a charge
    expect(Math.min(...money)).toBeGreaterThanOrEqual(100)
    expect(playRun(balanced(FOUR)).money).toBeGreaterThanOrEqual(100)
  })

  it('lets a lean run keep even more', () => {
    const lean = playRun(balanced({ features: ['combat', 'story', 'customization'] })).money
    expect(lean).toBeGreaterThan(playRun(balanced(FOUR)).money)
  })

  it('runs a reckless, over-scoped run out of money before the final sprint', () => {
    const money = moneyAfterEachClose(greedyBuilder([...EVERYTHING]))
    const brokeAt = money.findIndex((m) => m <= 0)
    expect(brokeAt).toBeGreaterThanOrEqual(0)
    expect(brokeAt + 1).toBeLessThanOrEqual(7) // broke by the close of sprint 7 at the latest
  })

  it('costs more to run a bigger game', () => {
    expect(sprintUpkeep('LOW')).toBeLessThan(sprintUpkeep('MEDIUM'))
    expect(sprintUpkeep('MEDIUM')).toBeLessThan(sprintUpkeep('HIGH'))
    expect(sprintUpkeep('HIGH')).toBeLessThan(sprintUpkeep('CRITICAL'))
  })

  it('never takes more than a quarter of the starting cash in one sprint until scope is critical', () => {
    for (const level of ['LOW', 'MEDIUM', 'HIGH'] as const) expect(sprintUpkeep(level)).toBeLessThan(125)
  })
})

describe('the ship decision is a real decision', () => {
  it('rewards patience when the project is under control', () => {
    const early = playRun(shipAtStartOf(balanced(FOUR), 4)).review!.score
    const late = playRun(balanced(FOUR)).review!.score
    expect(late).toBeGreaterThan(early + 10)
  })

  it('rewards bailing out early when the project is out of control', () => {
    const policy = greedyBuilder([...EVERYTHING])
    const early = playRun(shipAtStartOf(policy, 4)).review!.score
    const late = playRun(policy).review!.score
    expect(early).toBeGreaterThan(late)
  })

  it('is not available before sprint 4', () => {
    const tooSoon: Policy = (s) => (s.sprint < 4 ? 'ship' : balanced(FOUR)(s))
    expect(() => playRun(tooSoon)).toThrow(/before sprint 4/)
  })
})
