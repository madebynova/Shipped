import { describe, expect, it } from 'vitest'
import {
  CANCEL_HYPE_PENALTY,
  CANCEL_PENALTY,
  COMPLETE_BONUS,
  PROMISE_HURT_CAP,
  applyAction,
  bandFor,
  cancelPromise,
  computeLegacy,
  computeReview,
  endSprint,
  isComplete,
  launchUpdates,
  promiseAge,
  promisePenalty,
  promisedFeatures,
  recoveryCredit,
  retireGame,
  unresolvedPromises,
  validateAction,
  whyCannotCancel,
} from './index'
import type { Concept, FeatureId, RunState } from './index'
import { GENRES } from '../content/genres'
import { TEST_CONCEPT, firstLegal } from './testing/bots'
import { FOUR_BUILT, act, built, goLive, shippedRun } from './testing/helpers'

/** Close a live sprint without touching the build, and drop any event so only the maths shows. */
function age(state: RunState, sprints: number): RunState {
  let s = state
  for (let i = 0; i < sprints; i++) {
    while (s.actionsLeft > 0) s = act(s, firstLegal(s, [{ type: 'REST' }, { type: 'HYPE' }, { type: 'FIX' }]))
    s = endSprint(s)
    if (s.live?.pendingEvent) s = { ...s, live: { ...s.live, pendingEvent: null } }
  }
  return s
}

const FIVE_BUILT = { ...FOUR_BUILT, physics: built(72) }

describe('the recovery credit (how much of an improvement skeptical players believe)', () => {
  it('is 100% for a launch of 75 or better', () => {
    expect(recoveryCredit(75)).toBe(1)
    expect(recoveryCredit(90)).toBe(1)
  })

  it('falls 2% for every launch point under 75', () => {
    expect(recoveryCredit(70)).toBeCloseTo(0.9)
    expect(recoveryCredit(65)).toBeCloseTo(0.8)
    expect(recoveryCredit(55)).toBeCloseTo(0.6)
  })

  it('never falls below 40%', () => {
    expect(recoveryCredit(45)).toBeCloseTo(0.4)
    expect(recoveryCredit(20)).toBeCloseTo(0.4)
    expect(recoveryCredit(0)).toBeCloseTo(0.4)
  })
})

describe('the legacy score', () => {
  it('starts exactly equal to the launch score', () => {
    const s = goLive({ features: FOUR_BUILT, bugs: 3, hype: 20 })
    expect(computeLegacy(s).score).toBe(s.review!.score)
    expect(computeLegacy(s).band).toBe(s.review!.band)
  })

  it('is just the launch score when you retire straight from the review', () => {
    const shipped = shippedRun({ features: FOUR_BUILT, bugs: 3 })
    const legacy = computeLegacy(shipped)
    expect(legacy.score).toBe(shipped.review!.score)
    expect(legacy.complete).toBe(false)
    const retired = retireGame(shipped)
    expect(retired.legacy!.score).toBe(shipped.review!.score)
    expect(retired.legacy!.launchScore).toBe(shipped.review!.score)
    expect(retired.legacy!.releases).toBe(0)
    expect(retired.legacy!.liveSprints).toBe(0)
  })

  it('re-runs the review formula on the game as it stands now', () => {
    let s = goLive({ features: { ...FOUR_BUILT, combat: built(50) }, bugs: 4 })
    const before = computeLegacy(s).score
    s = act(s, { type: 'FIX' }) // fewer bugs
    s = act(s, { type: 'POLISH', featureId: 'combat' }) // better combat
    const after = computeLegacy(s)
    expect(after.review).toBe(computeReview(s).score)
    expect(after.score).toBeGreaterThan(before)
  })

  it('adds up: review - skepticism - promise penalty - cancel penalty + COMPLETE bonus', () => {
    const s = age(goLive({ features: FOUR_BUILT, bugs: 0 }), 3)
    const l = computeLegacy(s)
    expect(l.score).toBe(l.review - l.skepticism - l.promisePenalty - l.cancelPenalty + l.completeBonus)
    expect(l.promisePenalty).toBeGreaterThan(0)
  })

  it('stays between 0 and 100', () => {
    const awful = goLive({ features: { combat: built(5) }, bugs: 40 })
    expect(computeLegacy(awful).score).toBeGreaterThanOrEqual(0)
    const perfect = goLive({ features: { combat: built(100), story: built(100), crafting: built(100), customization: built(100), physics: built(100) }, bugs: 0 })
    expect(computeLegacy(perfect).score).toBeLessThanOrEqual(100)
  })

  it('reports a band for the score', () => {
    const l = computeLegacy(goLive({ features: FOUR_BUILT }))
    expect(l.band).toBe(bandFor(l.score))
  })

  it('discounts the climb back after a rough launch, but never the launch itself', () => {
    // A rough launch: poor quality, plenty of bugs.
    const rough = { combat: built(45), story: built(45), crafting: built(45), customization: built(45) }
    let s = goLive({ features: rough, bugs: 8 })
    const launch = s.review!.score
    expect(launch).toBeLessThan(55)
    expect(computeLegacy(s).skepticism).toBe(0) // no improvement yet, so nothing to discount

    // Now the game is made much better (set directly: this test is about the arithmetic).
    s = {
      ...s,
      bugs: 0,
      features: s.features.map((f) => (f.state !== 'PLANNED' ? { ...f, quality: 95, state: 'POLISHED' as const } : f)),
    }
    const l = computeLegacy(s)
    const gain = l.review - launch
    expect(gain).toBeGreaterThan(20)
    expect(l.skepticism).toBe(Math.round(gain * (1 - recoveryCredit(launch))))
    expect(l.score).toBeLessThan(l.review) // skeptical players only believe part of it
    expect(l.score).toBeGreaterThan(launch) // but it is still a real improvement
  })

  it('does not discount a decent launch at all', () => {
    let s = goLive({ features: { ...FOUR_BUILT, combat: built(55) }, bugs: 3 })
    s = { ...s, bugs: 0, features: s.features.map((f) => (f.state !== 'PLANNED' ? { ...f, quality: 95, state: 'POLISHED' as const } : f)) }
    const launch = s.review!.score
    expect(launch).toBeGreaterThanOrEqual(60)
    // 60-75 launches get a small discount; 75+ none. Check the formula rather than a magic number.
    expect(computeLegacy(s).skepticism).toBe(Math.round((computeLegacy(s).review - launch) * (1 - recoveryCredit(launch))))
  })

  it('does not discount a game that got WORSE: the audience believes every lost point', () => {
    let s = goLive({ features: FOUR_BUILT, bugs: 0 })
    s = { ...s, bugs: 10 }
    const l = computeLegacy(s)
    expect(l.review).toBeLessThan(s.review!.score)
    expect(l.skepticism).toBe(0)
  })
})

describe('COMPLETE: a fully made game', () => {
  it('needs every built feature POLISHED, no bugs, every promise kept, and at least four features', () => {
    const s = goLive({ features: FIVE_BUILT, bugs: 0 })
    expect(isComplete(s)).toBe(true)
    expect(computeLegacy(s).complete).toBe(true)
    expect(computeLegacy(s).completeBonus).toBe(COMPLETE_BONUS)
  })

  it('is lost by a single bug', () => {
    expect(isComplete({ ...goLive({ features: FIVE_BUILT }), bugs: 1 })).toBe(false)
  })

  it('is lost by one feature that is merely PLAYABLE', () => {
    const s = goLive({ features: { ...FIVE_BUILT, crafting: built(69) } })
    expect(isComplete(s)).toBe(false)
  })

  it('is lost by a promise that is still unbuilt', () => {
    const s = goLive({ features: FOUR_BUILT }) // physics (promised by an Action game) is unbuilt
    expect(unresolvedPromises(s)).toEqual(['physics'])
    expect(isComplete(s)).toBe(false)
  })

  it('is lost by a cancelled promise: that is a broken promise too', () => {
    const concept: Concept = { ...TEST_CONCEPT, seedFeatures: ['combat', 'vehicles'] }
    let s = goLive({ features: FOUR_BUILT, concept })
    s = cancelPromise(s, 'vehicles')
    expect(unresolvedPromises(s)).toEqual([])
    expect(isComplete({ ...s, bugs: 0 })).toBe(false)
  })

  it('needs a real game: three polished features are not enough', () => {
    const concept: Concept = { ...TEST_CONCEPT, seedFeatures: ['combat', 'story'] }
    const three = { combat: built(80), story: built(80), customization: built(80) }
    expect(isComplete(goLive({ features: three, concept }))).toBe(false)
    expect(isComplete(goLive({ features: { ...three, crafting: built(80) }, concept }))).toBe(true)
  })

  it('does not need all six features', () => {
    const s = goLive({ features: FIVE_BUILT })
    expect(s.features.filter((f) => f.state === 'PLANNED')).toHaveLength(1)
    expect(isComplete(s)).toBe(true)
  })

  it('describes the state of the game, so it counts straight from the review too', () => {
    const shipped = shippedRun({ features: FIVE_BUILT })
    expect(isComplete(shipped)).toBe(true)
    const legacy = computeLegacy(shipped)
    expect(legacy.complete).toBe(true)
    expect(legacy.completeBonus).toBe(COMPLETE_BONUS)
    expect(legacy.score).toBe(Math.min(100, shipped.review!.score + COMPLETE_BONUS))
  })

  it('gives the same stamp and the same score whether you retire at once or launch updates first', () => {
    const shipped = shippedRun({ features: FIVE_BUILT })
    const direct = retireGame(shipped).legacy!
    const viaUpdates = retireGame(launchUpdates(shipped)).legacy!
    expect(direct.complete).toBe(true)
    expect(viaUpdates.complete).toBe(true)
    expect(direct.score).toBe(viaUpdates.score)
  })

  it('does not stamp a game that is not fully made, however it is retired', () => {
    const shipped = shippedRun({ features: FOUR_BUILT }) // physics (promised by an Action game) is unbuilt
    expect(computeLegacy(shipped).complete).toBe(false)
    expect(retireGame(shipped).legacy!.score).toBe(shipped.review!.score)
  })

  it('adds the bonus to the final card when the game is retired complete', () => {
    const s = retireGame(goLive({ features: FIVE_BUILT }))
    expect(s.legacy!.complete).toBe(true)
    expect(s.legacy!.completeBonus).toBe(COMPLETE_BONUS)
    expect(s.legacy!.score).toBe(
      Math.min(100, s.legacy!.review - s.legacy!.skepticism - s.legacy!.promisePenalty - s.legacy!.cancelPenalty + COMPLETE_BONUS),
    )
  })
})

describe('promises', () => {
  const GENRE_SIGNATURES: Record<string, FeatureId[]> = {
    Action: ['combat', 'physics'],
    RPG: ['story', 'combat'],
    Racing: ['vehicles', 'physics'],
    Survival: ['crafting', 'combat'],
    Strategy: ['story', 'crafting'],
    Simulation: ['crafting', 'customization'],
  }

  it('come from the concept gallery seed features when there are any', () => {
    const concept: Concept = { title: 'X', idea: 'y', genre: 'Racing', seedFeatures: ['story', 'crafting', 'customization'] }
    expect(promisedFeatures(concept)).toEqual(['story', 'crafting', 'customization'])
  })

  it('fall back to the genre signature features for a game written by hand', () => {
    for (const genre of GENRES) {
      const concept: Concept = { title: 'X', idea: 'y', genre: genre.id }
      expect(promisedFeatures(concept)).toEqual(GENRE_SIGNATURES[genre.id])
      expect(genre.signature).toHaveLength(2)
    }
  })

  it('only the promised features that are cut at launch become promises', () => {
    const s = goLive({ features: FOUR_BUILT }) // Action: combat (built) and physics (cut)
    expect(s.live!.promises.map((p) => p.featureId)).toEqual(['physics'])
  })

  it('are none when everything promised shipped', () => {
    expect(goLive({ features: FIVE_BUILT }).live!.promises).toEqual([])
  })

  it('hurt the legacy score a little more every sprint, up to a cap', () => {
    let s = goLive({ features: FOUR_BUILT })
    const penalties = [promisePenalty(s)]
    for (let i = 0; i < 6; i++) {
      s = age(s, 1)
      penalties.push(promisePenalty(s))
    }
    expect(penalties.slice(0, 5)).toEqual([0, 1, 2, 3, 4]) // 1 point a sprint...
    expect(penalties.slice(4)).toEqual([4, 4, 4]) // ...and then it stops growing
    expect(PROMISE_HURT_CAP).toBe(4)
  })

  it('hurt per promise, so two broken promises hurt twice as much', () => {
    const concept: Concept = { ...TEST_CONCEPT, seedFeatures: ['physics', 'vehicles'] }
    const s = age(goLive({ features: FOUR_BUILT, concept }), 2)
    expect(unresolvedPromises(s)).toEqual(['physics', 'vehicles'])
    expect(promisePenalty(s)).toBe(4)
  })

  it('stop hurting the moment the feature is built', () => {
    let s = age(goLive({ features: FOUR_BUILT }), 3)
    expect(promisePenalty(s)).toBe(3)
    s = {
      ...s,
      features: s.features.map((f) => (f.id === 'physics' ? { ...f, state: 'PLAYABLE' as const, quality: 55, progress: 12 } : f)),
    }
    expect(unresolvedPromises(s)).toEqual([])
    expect(promisePenalty(s)).toBe(0)
  })

  it('count their age from the launch', () => {
    const s = age(goLive({ features: FOUR_BUILT }), 3)
    expect(promiseAge(s, 'physics')).toBe(3)
  })
})

describe('cancelling a promise', () => {
  const concept: Concept = { ...TEST_CONCEPT, seedFeatures: ['combat', 'physics'] }
  const live = () => age(goLive({ features: { ...FOUR_BUILT, physics: { progress: 4 } }, concept, hype: 40 }), 2)

  it('stops the growing penalty but costs 2 legacy points and 10 hype for good', () => {
    const before = live()
    expect(promisePenalty(before)).toBe(2)
    const after = cancelPromise(before, 'physics')
    expect(after.live!.cancelled).toEqual(['physics'])
    expect(promisePenalty(after)).toBe(0)
    expect(computeLegacy(after).cancelPenalty).toBe(CANCEL_PENALTY)
    expect(after.hype).toBe(before.hype - CANCEL_HYPE_PENALTY)
  })

  it('shelves half-built work', () => {
    const before = live()
    expect(before.features.find((f) => f.id === 'physics')!.progress).toBeGreaterThan(0)
    const after = cancelPromise(before, 'physics')
    expect(after.features.find((f) => f.id === 'physics')!.progress).toBe(0)
  })

  it('takes the feature off the menu for good', () => {
    const after = cancelPromise(live(), 'physics')
    expect(validateAction(after, { type: 'BUILD', featureId: 'physics' })).toMatch(/cancelled/i)
    expect(applyAction(after, { type: 'BUILD', featureId: 'physics' }).ok).toBe(false)
  })

  it('is recorded in the history', () => {
    const after = cancelPromise(live(), 'physics')
    expect(after.history.at(-1)).toMatchObject({ kind: 'cancel', featureId: 'physics' })
  })

  it('can be done once, to an open promise, and only in the live phase', () => {
    const before = live()
    const once = cancelPromise(before, 'physics')
    expect(cancelPromise(once, 'physics')).toBe(once) // already cancelled
    expect(cancelPromise(before, 'combat')).toBe(before) // combat is built: not an open promise
    expect(whyCannotCancel(before, 'story')).not.toBeNull()
    const shipped = shippedRun({ features: FOUR_BUILT })
    expect(cancelPromise(shipped, 'physics')).toBe(shipped)
    expect(whyCannotCancel(shipped, 'physics')).toMatch(/live/i)
  })

  it('is cheaper than waiting a long time, but dearer than a quick build', () => {
    // Waiting costs 1 point a sprint up to 4; cancelling costs 2 for good.
    const patient = age(live(), 6)
    expect(promisePenalty(patient)).toBe(4)
    expect(CANCEL_PENALTY).toBeLessThan(promisePenalty(patient))
    expect(promisePenalty(live())).toBe(2) // after two sprints they cost the same
  })

  it('also lowers the final card, even if the game is retired right away', () => {
    const concept2: Concept = { ...TEST_CONCEPT, seedFeatures: ['combat', 'physics'] }
    const s = cancelPromise(goLive({ features: FOUR_BUILT, concept: concept2 }), 'physics')
    const final = retireGame(s).legacy!
    expect(final.cancelPenalty).toBe(CANCEL_PENALTY)
    expect(final.complete).toBe(false)
  })

  it('launching updates and retiring work together', () => {
    const shipped = shippedRun({ features: FOUR_BUILT })
    expect(retireGame(launchUpdates(shipped)).phase).toBe('retired')
  })
})
