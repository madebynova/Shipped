// These tests pin down the DESIGN INTENT of the live phase, found while tuning with headless bots.
// If you rebalance and one fails, decide whether the design changed, not just the number.
//
//   - a decent launch (70s) with smart updates ends at 85-95 (a COMPLETE game can reach 100)
//   - a ~73 launch is clearly fixable into the 80s
//   - a disaster is partly fixable, never fully: the first impression keeps mattering
//   - COMPLETE is reachable with great play (a few sprints for a lean game), not by grinding
//   - doing nothing loses the game: sales fade, bugs pile up and the money runs out
import { describe, expect, it } from 'vitest'
import { COMPLETE_BONUS, recoveryCredit, replayHistory, retireGame } from './index'
import type { RunState } from './index'
import type { Policy } from './testing/bots'
import { TEST_CONCEPT, balanced, hypeSpammer, idleLive, playLive, playRun, smartLive } from './testing/bots'

const ALL = ['customization', 'story', 'crafting', 'combat', 'physics', 'vehicles'] as const
const FOUR = ['combat', 'story', 'crafting', 'customization'] as const
const SEEDS = [1, 2, 3, 4, 5, 6]

/** Ship at the first chance on or after `sprint` (never before sprint 4). */
const shipAt = (sprint: number, inner: Policy): Policy => (s) => (s.sprint >= sprint && s.sprint >= 4 ? 'ship' : inner(s))

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

interface Scenario {
  name: string
  pre: Policy
}

const LEAN: Scenario = { name: 'lean three-feature game', pre: balanced({ features: ['combat', 'story', 'customization'] }) }
const FIVE: Scenario = { name: 'five features (critical scope)', pre: balanced({ features: [...FOUR, 'physics'] }) }
const SLOPPY_FOUR: Scenario = {
  name: 'sloppy four (never fixes or rests)',
  pre: balanced({ features: [...FOUR], restBelow: 0, fixAbove: 99, polishTo: 0, hypeSlots: 0 }),
}
const ROUGH_FOUR: Scenario = { name: 'four, shipped early', pre: shipAt(5, balanced({ features: [...FOUR] })) }
const ROUGH_TWO: Scenario = { name: 'two features, rushed', pre: shipAt(4, balanced({ features: ['combat', 'customization'] })) }
const OVERHYPED: Scenario = {
  name: 'two rushed features, over-hyped',
  pre: shipAt(4, balanced({ features: ['combat', 'customization'], restBelow: 0, fixAbove: 99, polishTo: 0, hypeSlots: 12 })),
}
const HYPE_ONLY: Scenario = { name: 'hype and nothing else', pre: hypeSpammer }

function results(scenario: Scenario, live = smartLive(), seeds = SEEDS) {
  return seeds.map((seed) => {
    const shipped = playRun(scenario.pre, TEST_CONCEPT, seed)
    const end = playLive(shipped, live)
    return { shipped, end, launch: shipped.review!.score, legacy: end.legacy!.score }
  })
}

describe('smart updates after a decent launch (70s)', () => {
  it('start from a launch in the 70s', () => {
    for (const s of [LEAN, FIVE]) {
      const launch = playRun(s.pre, TEST_CONCEPT, 1).review!.score
      expect(launch, s.name).toBeGreaterThanOrEqual(68)
      expect(launch, s.name).toBeLessThanOrEqual(82)
    }
  })

  it('end in the 85-95 range, and COMPLETE games reach the top', () => {
    for (const scenario of [LEAN, FIVE]) {
      const out = results(scenario)
      for (const r of out) {
        expect(r.legacy, `${scenario.name}: legacy ${r.legacy}`).toBeGreaterThanOrEqual(80)
        if (!r.end.legacy!.complete) expect(r.legacy, `${scenario.name} (not complete)`).toBeLessThanOrEqual(96)
      }
      expect(mean(out.map((r) => r.legacy)), scenario.name).toBeGreaterThanOrEqual(85)
      expect(Math.max(...out.map((r) => r.legacy)), scenario.name).toBeGreaterThanOrEqual(90)
    }
  })

  it('beat the launch score by a clear margin', () => {
    for (const r of results(FIVE)) expect(r.legacy - r.launch).toBeGreaterThanOrEqual(10)
  })

  it('make a launch of about 73 clearly fixable into the 80s', () => {
    // Look for pre-launch plans that land in the low-to-mid 70s, and check what updates do to them.
    const candidates: Scenario[] = [
      FIVE,
      { name: 'four, shipped sprint 6', pre: shipAt(6, balanced({ features: [...FOUR] })) },
      { name: 'four, shipped sprint 7', pre: shipAt(7, balanced({ features: [...FOUR] })) },
      { name: 'lean, shipped sprint 5', pre: shipAt(5, balanced({ features: ['combat', 'story', 'customization'] })) },
      { name: 'sloppy four', pre: SLOPPY_FOUR.pre },
    ]
    let checked = 0
    for (const c of candidates) {
      for (const seed of SEEDS) {
        const shipped = playRun(c.pre, TEST_CONCEPT, seed)
        const launch = shipped.review!.score
        if (launch < 68 || launch > 78) continue
        checked++
        const legacy = playLive(shipped, smartLive()).legacy!.score
        expect(legacy, `${c.name} launched ${launch}`).toBeGreaterThanOrEqual(80)
        expect(legacy, `${c.name} launched ${launch}`).toBeGreaterThan(launch + 5)
      }
    }
    expect(checked).toBeGreaterThanOrEqual(6) // the scenario really was exercised
  })
})

describe('a rough launch (about 55-60) recovers a lot, but less', () => {
  it('ends in the 70s and low 80s, below what a decent launch reaches', () => {
    const rough = [...results(ROUGH_FOUR), ...results(ROUGH_TWO)]
    for (const r of rough) {
      expect(r.launch).toBeLessThan(65)
      expect(r.legacy, `launch ${r.launch}`).toBeGreaterThan(r.launch + 12)
    }
    const decent = results(FIVE)
    expect(mean(rough.map((r) => r.legacy))).toBeLessThan(mean(decent.map((r) => r.legacy)))
  })
})

describe('a disaster is partly fixable, never fully', () => {
  const disasters = () => [...results(OVERHYPED), ...results(HYPE_ONLY)]

  it('starts as a disaster', () => {
    for (const r of disasters()) expect(r.launch).toBeLessThan(25)
  })

  it('gets a lot better with smart updates', () => {
    for (const r of disasters()) expect(r.legacy, `launch ${r.launch}`).toBeGreaterThanOrEqual(r.launch + 20)
  })

  it('but never becomes a hit: the first impression keeps its grip', () => {
    for (const r of disasters()) expect(r.legacy, `launch ${r.launch}`).toBeLessThan(65)
  })

  it('is capped by the skepticism formula: launch + credit x the improvement available (+ COMPLETE)', () => {
    for (const r of [...disasters(), ...results(ROUGH_FOUR), ...results(FIVE)]) {
      const ceiling = r.launch + recoveryCredit(r.launch) * (100 - r.launch) + COMPLETE_BONUS + 1
      expect(r.legacy).toBeLessThanOrEqual(ceiling)
    }
  })

  it('leaves a bug-ridden, over-scoped game unrecoverable (early decisions matter most)', () => {
    const wreck = playRun(balanced({ features: [...ALL], restBelow: 0, fixAbove: 99, polishTo: 0, hypeSlots: 0 }), TEST_CONCEPT, 1)
    const end = playLive(wreck, smartLive())
    expect(end.legacy!.score - wreck.review!.score).toBeLessThan(5)
  })
})

describe('the launch score keeps meaning something', () => {
  it('orders outcomes: a decent launch ends higher than a rough one, which ends higher than a disaster', () => {
    const decent = mean(results(FIVE).map((r) => r.legacy))
    const rough = mean([...results(ROUGH_FOUR), ...results(ROUGH_TWO)].map((r) => r.legacy))
    const disaster = mean([...results(OVERHYPED), ...results(HYPE_ONLY)].map((r) => r.legacy))
    expect(decent).toBeGreaterThan(rough)
    expect(rough).toBeGreaterThan(disaster + 10)
  })

  it('is recorded unchanged on every final card', () => {
    for (const scenario of [LEAN, FIVE, ROUGH_TWO, HYPE_ONLY]) {
      for (const r of results(scenario, smartLive(), [1, 2])) {
        expect(r.end.legacy!.launchScore).toBe(r.shipped.review!.score)
        expect(r.end.review).toEqual(r.shipped.review)
      }
    }
  })

  it('pays less revenue for a worse launch', () => {
    const sales = (s: Scenario) => playRun(s.pre, TEST_CONCEPT, 1).review!.sales.total
    expect(sales(LEAN)).toBeGreaterThan(sales(ROUGH_TWO))
    expect(sales(ROUGH_TWO)).toBeGreaterThan(sales(OVERHYPED))
  })
})

describe('the COMPLETE stamp', () => {
  const lean = () => playLive(playRun(LEAN.pre, TEST_CONCEPT, 1), smartLive())

  it('is reachable with great play on a lean game', () => {
    const end = lean()
    expect(end.legacy!.complete).toBe(true)
    expect(end.legacy!.completeBonus).toBe(COMPLETE_BONUS)
  })

  it('takes a few focused sprints, not a grind', () => {
    const end = lean()
    const actions = end.history.filter((e) => e.kind === 'action').length - playRun(LEAN.pre, TEST_CONCEPT, 1).history.filter((e) => e.kind === 'action').length
    expect(end.legacy!.liveSprints).toBeLessThanOrEqual(6)
    expect(actions).toBeLessThanOrEqual(18) // six sprints of three slots
  })

  it('needs every promise kept: a game that cancels one can never be COMPLETE', () => {
    const cancelAll = playLive(playRun(LEAN.pre, TEST_CONCEPT, 1), smartLive({ keepPromises: false }))
    expect(cancelAll.legacy!.complete).toBe(false)
  })

  it('is not handed out for free: idle games, rough launches and wrecks never get it', () => {
    expect(playLive(playRun(LEAN.pre, TEST_CONCEPT, 1), idleLive).legacy!.complete).toBe(false)
    expect(playLive(playRun(ROUGH_TWO.pre, TEST_CONCEPT, 1), idleLive).legacy!.complete).toBe(false)
  })

  it('is harder at critical scope, where money is the limit', () => {
    const critical = results(FIVE)
    const rate = critical.filter((r) => r.end.legacy!.complete).length / critical.length
    const leanRate = results(LEAN).filter((r) => r.end.legacy!.complete).length / SEEDS.length
    expect(leanRate).toBeGreaterThanOrEqual(rate)
    expect(critical.some((r) => r.end.legacy!.reason === 'broke')).toBe(true)
  })
})

describe('doing nothing loses', () => {
  it('lets sales fade, bugs pile up, and the money run out', () => {
    for (const seed of [1, 2, 3]) {
      const shipped = playRun(balanced({ features: [...FOUR] }), TEST_CONCEPT, seed)
      const end = playLive(shipped, idleLive)
      expect(end.legacy!.reason).toBe('broke')
      expect(end.legacy!.score).toBeLessThan(shipped.review!.score)
    }
  })

  it('runs out sooner for a bigger game', () => {
    const four = playLive(playRun(balanced({ features: [...FOUR] }), TEST_CONCEPT, 1), idleLive)
    const six = playLive(playRun(balanced({ features: [...ALL] }), TEST_CONCEPT, 1), idleLive)
    expect(six.legacy!.liveSprints).toBeLessThan(four.legacy!.liveSprints)
  })

  it('never takes the studio under in the first few sprints of a decent game', () => {
    for (const seed of SEEDS) {
      const end = playLive(playRun(balanced({ features: [...FOUR] }), TEST_CONCEPT, seed), idleLive)
      expect(end.legacy!.liveSprints).toBeGreaterThanOrEqual(8)
    }
  })
})

describe('whole live runs are reproducible', () => {
  const play = (seed: number, scenario = FIVE) => playLive(playRun(scenario.pre, TEST_CONCEPT, seed), smartLive())

  it('give identical results for identical play', () => {
    expect(play(3)).toEqual(play(3))
  })

  it('differ by seed only through events and flavour text, not through the rules', () => {
    const a = play(1)
    const b = play(2)
    expect(a.legacy!.launchScore).toBe(b.legacy!.launchScore)
  })

  it('replay from the recorded history to exactly the same final state', () => {
    for (const scenario of [LEAN, FIVE, ROUGH_TWO, HYPE_ONLY]) {
      for (const seed of [1, 2, 3]) {
        const end: RunState = play(seed, scenario)
        const replayed = replayHistory(end, end.history)
        expect(replayed, `${scenario.name} seed ${seed}`).toEqual(end)
      }
    }
  })

  it('replay forced closures too', () => {
    const end = playLive(playRun(balanced({ features: [...FOUR] }), TEST_CONCEPT, 2), idleLive)
    expect(end.legacy!.reason).toBe('broke')
    expect(replayHistory(end, end.history)).toEqual(end)
  })

  it('replay a game that was retired straight from the review', () => {
    const shipped = playRun(balanced({ features: [...FOUR] }), TEST_CONCEPT, 4)
    const end = retireGame(shipped)
    expect(end.live).toBeNull()
    expect(replayHistory(end, end.history)).toEqual(end)
  })

  it('replay a game that launched updates and retired at once', () => {
    const shipped = playRun(balanced({ features: [...FOUR] }), TEST_CONCEPT, 4)
    const end = playLive(shipped, () => 'retire')
    expect(end.live).not.toBeNull()
    expect(replayHistory(end, end.history)).toEqual(end)
  })
})
