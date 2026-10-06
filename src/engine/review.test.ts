import { describe, expect, it } from 'vitest'
import { bandFor, buildCost, computeReview, originalityScore } from './index'
import type { Concept, FeatureId, RunState } from './index'
import { freshRun } from './testing/helpers'

type Build = Partial<Record<FeatureId, number>>

/** A finished-game state: each listed feature is built at the given quality. */
function shipState(
  built: Build,
  extra: Partial<Pick<RunState, 'bugs' | 'hype' | 'morale' | 'money' | 'sprint' | 'concept'>> = {},
): RunState {
  const base = freshRun()
  return {
    ...base,
    ...extra,
    phase: 'shipped',
    features: base.features.map((f) => {
      const quality = built[f.id]
      if (quality === undefined) return f
      return { ...f, state: quality >= 70 ? 'POLISHED' : 'PLAYABLE', progress: buildCost(f), quality }
    }),
  }
}

const GOOD: Build = { combat: 85, story: 85, crafting: 85, customization: 85 }
const WEAK: Build = { customization: 40 }

describe('score bands', () => {
  it.each([
    [100, 'MASTERPIECE'],
    [90, 'MASTERPIECE'],
    [89, 'GREAT'],
    [75, 'GREAT'],
    [74, 'SOLID'],
    [60, 'SOLID'],
    [59, 'ROUGH'],
    [45, 'ROUGH'],
    [44, 'DISASTER'],
    [25, 'DISASTER'],
    [24, 'LEGENDARY FAILURE'],
    [0, 'LEGENDARY FAILURE'],
  ] as const)('%i is %s', (score, band) => {
    expect(bandFor(score)).toBe(band)
  })
})

describe('review dimensions', () => {
  it('scores an empty build as a legendary failure', () => {
    const r = computeReview(shipState({}))
    expect(r.gameplay).toBe(0)
    expect(r.content).toBe(0)
    expect(r.polish).toBe(0)
    expect(r.score).toBeLessThan(25)
    expect(r.band).toBe('LEGENDARY FAILURE')
  })

  it('keeps every number inside 0-100', () => {
    for (const built of [{}, WEAK, GOOD, { combat: 100, story: 100, crafting: 100, physics: 100, vehicles: 100, customization: 100 }]) {
      for (const bugs of [0, 5, 40, 200]) {
        for (const hype of [0, 50, 100]) {
          const r = computeReview(shipState(built, { bugs, hype }))
          for (const n of [r.score, r.gameplay, r.content, r.polish, r.originality]) {
            expect(n).toBeGreaterThanOrEqual(0)
            expect(n).toBeLessThanOrEqual(100)
          }
        }
      }
    }
  })

  it('rewards more of the game actually being built (CONTENT and GAMEPLAY)', () => {
    const small = computeReview(shipState({ customization: 80 }))
    const larger = computeReview(shipState({ customization: 80, story: 80, combat: 80 }))
    expect(larger.content).toBeGreaterThan(small.content)
    expect(larger.gameplay).toBeGreaterThan(small.gameplay)
  })

  it('rewards quality (GAMEPLAY and POLISH)', () => {
    const rough = computeReview(shipState({ combat: 45, story: 45 }))
    const refined = computeReview(shipState({ combat: 90, story: 90 }))
    expect(refined.polish).toBeGreaterThan(rough.polish)
    expect(refined.gameplay).toBeGreaterThan(rough.gameplay)
    expect(refined.content).toBe(rough.content) // content is about quantity, not quality
  })

  it('punishes bugs in GAMEPLAY, POLISH and CONTENT', () => {
    const clean = computeReview(shipState(GOOD, { bugs: 0 }))
    const buggy = computeReview(shipState(GOOD, { bugs: 12 }))
    expect(buggy.gameplay).toBeLessThan(clean.gameplay)
    expect(buggy.polish).toBeLessThan(clean.polish)
    expect(buggy.content).toBeLessThan(clean.content)
    expect(buggy.score).toBeLessThan(clean.score)
  })

  it('does not count features that are still only PLANNED', () => {
    const base = freshRun()
    const partial = {
      ...shipState(WEAK),
      features: shipState(WEAK).features.map((f) => (f.id === 'combat' ? { ...base.features[0], progress: 8 } : f)),
    }
    expect(computeReview(partial).content).toBe(computeReview(shipState(WEAK)).content)
  })

  it('can reach the top band with a strong, clean, well-hyped game', () => {
    const r = computeReview(
      shipState({ combat: 100, physics: 100, story: 100, crafting: 100 }, {
        hype: 40,
        concept: {
          title: 'X',
          idea: 'A rain-soaked city where gravity flips each night and every neighbour hides a secret.',
          genre: 'Simulation',
        },
      }),
    )
    expect(r.score).toBeGreaterThanOrEqual(90)
    expect(r.band).toBe('MASTERPIECE')
  })
})

describe('hype', () => {
  it('does nothing when there is no hype', () => {
    expect(computeReview(shipState(GOOD)).hypeModifier).toBe(0)
    expect(computeReview(shipState(WEAK)).hypeModifier).toBe(0)
  })

  it('rewards a good game that was hyped', () => {
    const quiet = computeReview(shipState(GOOD, { hype: 0 }))
    const hyped = computeReview(shipState(GOOD, { hype: 50 }))
    expect(hyped.hypeModifier).toBeGreaterThan(0)
    expect(hyped.score).toBeGreaterThan(quiet.score)
  })

  it('punishes a bad game that was hyped', () => {
    const quiet = computeReview(shipState(WEAK, { hype: 0 }))
    const hyped = computeReview(shipState(WEAK, { hype: 60 }))
    expect(hyped.hypeModifier).toBeLessThan(0)
    expect(hyped.score).toBeLessThan(quiet.score)
  })

  it('raises the bar the audience expects as hype grows', () => {
    const lo = computeReview(shipState(GOOD, { hype: 10 }))
    const hi = computeReview(shipState(GOOD, { hype: 90 }))
    expect(hi.hypeBar).toBeGreaterThan(lo.hypeBar)
  })

  it('shows the final score as base score plus the hype modifier', () => {
    const r = computeReview(shipState({ combat: 55, story: 50 }, { hype: 70 }))
    expect(r.score).toBe(Math.max(0, Math.min(100, r.baseScore + r.hypeModifier)))
  })
})

describe('determinism', () => {
  it('gives the same review for the same state, every time', () => {
    const s = shipState(GOOD, { bugs: 3, hype: 24 })
    expect(computeReview(s)).toEqual(computeReview(s))
  })

  it('does not depend on the seed, the RNG state or the log', () => {
    const a = shipState(GOOD, { bugs: 3, hype: 24 })
    const b: RunState = { ...a, seed: 123456, rng: 98765, log: [] }
    expect(computeReview(b)).toEqual(computeReview(a))
  })
})

describe('originality', () => {
  const concept = (idea: string, genre: Concept['genre'] = 'Action'): Concept => ({ title: 'T', idea, genre })

  it('is deterministic and bounded', () => {
    const c = concept('A brutal physics-driven hand-to-hand combat game where every hit matters.')
    expect(originalityScore(c)).toBe(originalityScore(c))
    for (const idea of ['', 'x', 'word '.repeat(80), c.idea]) {
      const o = originalityScore(concept(idea))
      expect(o).toBeGreaterThanOrEqual(10)
      expect(o).toBeLessThanOrEqual(95)
    }
  })

  it('likes a specific, varied idea more than a one-word one', () => {
    const rich = concept('A lighthouse keeper tames storms by composing music for sleeping sea giants.')
    const thin = concept('fun game')
    expect(originalityScore(rich)).toBeGreaterThan(originalityScore(thin))
  })

  it('penalises repetition over real variety', () => {
    const spam = concept('cool cool cool cool cool cool cool cool cool cool cool cool')
    const varied = concept('cool lanterns guide nervous robots through haunted greenhouse mazes')
    expect(originalityScore(varied)).toBeGreaterThan(originalityScore(spam))
  })

  it('depends on the genre', () => {
    const idea = 'A lighthouse keeper tames storms by composing music for sleeping sea giants.'
    expect(originalityScore(concept(idea, 'Simulation'))).not.toBe(originalityScore(concept(idea, 'Action')))
  })
})

describe('verdict text reflects the real run', () => {
  const text = (s: RunState) => computeReview(s).verdict.join(' ')

  it('opens with the game title', () => {
    const r = computeReview(shipState(GOOD, { concept: { title: 'Moon Harvest', idea: 'farm on the moon', genre: 'Simulation' } }))
    expect(r.verdict[0]).toContain('Moon Harvest')
  })

  it('calls out a high bug count', () => {
    expect(text(shipState(GOOD, { bugs: 9 }))).toContain('the bugs frequently get in the way')
    expect(text(shipState(GOOD, { bugs: 20 }))).toContain('20 known')
  })

  it('praises a clean build', () => {
    expect(text(shipState(GOOD, { bugs: 0 }))).toContain('remarkably stable')
    expect(text(shipState(GOOD, { bugs: 2 }))).toContain('Stability is a quiet strength: only 2 known bugs')
  })

  it('says the audience expected more when hype outran the game', () => {
    expect(text(shipState({ combat: 45, story: 45 }, { hype: 60 }))).toContain(
      'The audience expected more than the final build could deliver.',
    )
  })

  it('says the buzz paid off when hype was earned', () => {
    expect(text(shipState(GOOD, { hype: 50 }))).toContain('The buzz paid off')
  })

  it('credits strong refinement of a small feature set', () => {
    expect(text(shipState({ combat: 100, customization: 100 }))).toContain(
      'The smaller feature set benefits from unusually strong refinement.',
    )
  })

  it('says so when nothing was playable', () => {
    expect(text(shipState({}))).toContain('nothing was playable')
  })

  it('mentions running out of money and a worn-out team', () => {
    const t = text(shipState(GOOD, { money: -26, morale: 10 }))
    expect(t).toContain('ran out of money')
    expect(t).toContain('running on fumes')
  })

  it('stays short and never repeats itself', () => {
    const lines = computeReview(shipState(GOOD, { bugs: 9, hype: 40, money: -5, morale: 10 })).verdict
    expect(lines.length).toBeLessThanOrEqual(4)
    expect(new Set(lines).size).toBe(lines.length)
  })
})
