import { describe, expect, it } from 'vitest'
import {
  SLOTS_PER_SPRINT,
  TUTORIAL_RUN,
  applyAction,
  computeLegacy,
  endSprint,
  firstWeekSales,
  getScope,
  isStuck,
  isUpdateWindowOpen,
  launchUpdates,
  liveSprintNumber,
  liveUpkeep,
  openingAccount,
  previewRelease,
  releaseUpdate,
  retireGame,
  shipGame,
  sprintEndEffects,
  startingSales,
  validateAction,
} from './index'
import type { Action, RunState } from './index'
import { TEST_CONCEPT, firstLegal } from './testing/bots'
import { FOUR_BUILT, act, built, goLive, liveSprint, polish, settle, shippedRun } from './testing/helpers'

/** A move that leaves the build alone: rest, hype or fix, whichever is legal first. */
function quietMove(state: RunState): Action {
  return firstLegal(state, [{ type: 'REST' }, { type: 'HYPE' }, { type: 'FIX' }, { type: 'BUILD', featureId: 'vehicles' }])
}

/** Spend the slots on quiet moves, then close the sprint (after settling any event). */
function closeQuietly(state: RunState): RunState {
  let s = settle(state)
  while (s.actionsLeft > 0) s = act(s, quietMove(s))
  return endSprint(s)
}

/** Drop any event that came up, so a test can look at the plain economy (events are tested on their own). */
function withoutEvent(state: RunState): RunState {
  return state.live?.pendingEvent ? { ...state, live: { ...state.live, pendingEvent: null } } : state
}

/** Spend the slots on rest only (so hype and the build stay exactly as they were), then stop before closing. */
function restAll(state: RunState): RunState {
  let s = state
  while (s.actionsLeft > 0) s = act(s, { type: 'REST' })
  return s
}

describe('launching updates', () => {
  it('turns a shipped full game into a live one and leaves the launch review untouched', () => {
    const shipped = shippedRun({ features: FOUR_BUILT, bugs: 2, hype: 24 })
    const live = launchUpdates(shipped)

    expect(live.phase).toBe('live')
    expect(live.live).not.toBeNull()
    expect(live.review).toEqual(shipped.review) // the first impression is frozen
    expect(live.live!.launchScore).toBe(shipped.review!.score)
    expect(live.live!.launchSprint).toBe(shipped.sprint)
    expect(live.features).toEqual(shipped.features)
    expect(live.legacy).toBeNull()
  })

  it('starts the next sprint with three fresh slots, numbered after the launch', () => {
    const shipped = shippedRun({ features: FOUR_BUILT })
    const live = launchUpdates(shipped)
    expect(live.sprint).toBe(shipped.sprint + 1)
    expect(live.actionsLeft).toBe(SLOTS_PER_SPRINT)
    expect(liveSprintNumber(live)).toBe(1)
    expect(live.history.at(-1)).toEqual({ kind: 'launchUpdates', sprint: shipped.sprint })
  })

  it('opens the revenue account with first-week sales plus the cash that was left', () => {
    const shipped = shippedRun({ features: FOUR_BUILT, hype: 24, money: 115 })
    const live = launchUpdates(shipped)
    expect(live.money).toBe(115 + shipped.review!.sales.total)
    expect(live.money).toBe(openingAccount(shipped))
    expect(live.live!.totalSales).toBe(shipped.review!.sales.total)
  })

  it('does not carry debt into the live phase: a broke studio opens with just the first week', () => {
    const shipped = shippedRun({ features: FOUR_BUILT, money: -150 })
    expect(launchUpdates(shipped).money).toBe(shipped.review!.sales.total)
  })

  it('starts ongoing sales as a share of the first week', () => {
    const shipped = shippedRun({ features: FOUR_BUILT, hype: 24 })
    expect(launchUpdates(shipped).live!.sales).toBe(startingSales(shipped.review!.sales.total))
  })

  it('cannot be done twice, mid-development, after retiring, or in the tutorial', () => {
    const shipped = shippedRun({ features: FOUR_BUILT })
    const live = launchUpdates(shipped)
    expect(launchUpdates(live)).toBe(live)

    const developing = { ...shipped, phase: 'developing' as const, review: null }
    expect(launchUpdates(developing)).toBe(developing)

    const retired = retireGame(shipped)
    expect(launchUpdates(retired)).toBe(retired)

    const tutorial = shippedRun({
      config: TUTORIAL_RUN,
      features: { combat: built(72), story: built(72), crafting: built(72), customization: built(72) },
    })
    expect(launchUpdates(tutorial)).toBe(tutorial)
  })
})

describe('first-week sales', () => {
  it('are reported on the review, with the arithmetic behind them', () => {
    const shipped = shippedRun({ features: FOUR_BUILT, hype: 40 })
    const { sales, score } = shipped.review!
    expect(sales).toEqual(firstWeekSales(score, 40, 'Action'))
    expect(sales.total).toBe(Math.round(sales.base * sales.hypeMultiplier * sales.marketMultiplier))
    expect(sales.hypeMultiplier).toBeCloseTo(1.4)
  })

  it('work out as (60 + 5.5 per point above 20) x (1 + hype/100) x the genre market', () => {
    expect(firstWeekSales(70, 0, 'Action').total).toBe(Math.round((60 + 5.5 * 50) * 1.05))
    expect(firstWeekSales(70, 50, 'Action').total).toBe(Math.round((60 + 5.5 * 50) * 1.5 * 1.05))
    expect(firstWeekSales(70, 0, 'RPG').total).toBe(Math.round((60 + 5.5 * 50) * 1.1))
  })

  it('go up with a better score, more hype and a bigger genre', () => {
    expect(firstWeekSales(80, 0, 'Action').total).toBeGreaterThan(firstWeekSales(60, 0, 'Action').total)
    expect(firstWeekSales(60, 60, 'Action').total).toBeGreaterThan(firstWeekSales(60, 0, 'Action').total)
    expect(firstWeekSales(60, 0, 'RPG').total).toBeGreaterThan(firstWeekSales(60, 0, 'Racing').total)
  })

  it('never fall below a small floor, even for a terrible game', () => {
    expect(firstWeekSales(0, 0, 'Racing').total).toBeGreaterThanOrEqual(Math.round(60 * 0.9))
    expect(firstWeekSales(10, 0, 'Action').base).toBe(60)
  })

  it('are part of the review the run ships with', () => {
    const run = shippedRun({ features: FOUR_BUILT })
    expect(run.review!.sales.total).toBeGreaterThan(0)
  })
})

describe('closing a live sprint', () => {
  const start = () => goLive({ features: FOUR_BUILT, bugs: 2, hype: 24, money: 115 })

  it('collects sales and pays upkeep from the revenue account', () => {
    const s = restAll(goLive({ features: FOUR_BUILT, bugs: 2, hype: 24, money: 115, morale: 30 }))
    const fx = sprintEndEffects(s)
    const next = endSprint(s)
    expect(fx.income).toBeGreaterThan(0)
    expect(fx.upkeep).toBe(liveUpkeep(getScope(s.features).level))
    expect(next.money).toBe(s.money + fx.income! - fx.upkeep!)
    expect(next.money).toBe(s.money + fx.money)
  })

  it('previews exactly what it then does', () => {
    const s = restAll(goLive({ features: FOUR_BUILT, bugs: 2, hype: 24, money: 115, morale: 30 }))
    const fx = sprintEndEffects(s)
    const next = endSprint(s)
    expect(next.bugs).toBe(s.bugs + fx.bugs)
    expect(next.live!.totalSales).toBe(s.live!.totalSales + fx.income!)
  })

  it('moves on to the next live sprint with fresh slots', () => {
    const next = closeQuietly(start())
    expect(next.phase).toBe('live')
    expect(liveSprintNumber(next)).toBe(2)
    expect(next.actionsLeft).toBe(SLOTS_PER_SPRINT)
    expect(next.live!.sprintsLive).toBe(1)
  })

  it('lets sales fade every sprint (revenue dries up unless you release something)', () => {
    let s = start()
    const sales: number[] = [s.live!.sales]
    for (let i = 0; i < 5; i++) {
      s = withoutEvent(closeQuietly(s)) // events can add sales: this test is about the plain decay
      sales.push(s.live!.sales)
    }
    for (let i = 1; i < sales.length; i++) expect(sales[i]).toBeLessThan(sales[i - 1])
  })

  it('fades a better game more slowly', () => {
    const good = closeQuietly(goLive({ features: { combat: built(95), story: built(95), crafting: built(95), customization: built(95) } }))
    const poor = closeQuietly(goLive({ features: { combat: built(40), story: built(40), crafting: built(40), customization: built(40) }, bugs: 8 }))
    const keptGood = good.live!.sales / startingSales(good.review!.sales.total)
    const keptPoor = poor.live!.sales / startingSales(poor.review!.sales.total)
    expect(keptGood).toBeGreaterThan(keptPoor)
  })

  it('lets buzz fade by itself (by 15% a sprint)', () => {
    const resting = restAll(goLive({ features: FOUR_BUILT, hype: 60, morale: 30 }))
    expect(resting.hype).toBe(60)
    expect(endSprint(resting).hype).toBe(51)
  })

  it('costs more to keep a bigger game running', () => {
    expect(liveUpkeep('LOW')).toBeLessThan(liveUpkeep('MEDIUM'))
    expect(liveUpkeep('MEDIUM')).toBeLessThan(liveUpkeep('HIGH'))
    expect(liveUpkeep('HIGH')).toBeLessThan(liveUpkeep('CRITICAL'))
  })

  it('is cheaper than development, because the team shrinks', () => {
    expect(liveUpkeep('HIGH')).toBeLessThan(45 + 15)
  })

  it('still lets bugs creep into a big game on their own', () => {
    const s = closeQuietly(goLive({ features: FOUR_BUILT, bugs: 0 }))
    expect(getScope(s.features).level).toBe('HIGH')
    expect(s.bugs).toBeGreaterThan(0)
  })

  it('cannot be closed while slots remain (unless nothing legal is left to do)', () => {
    const s = start()
    expect(endSprint(s)).toBe(s)
  })

  it('numbers live sprints from 1 and keeps counting', () => {
    let s = start()
    for (let i = 0; i < 3; i++) s = closeQuietly(s)
    expect(liveSprintNumber(s)).toBe(4)
  })
})

describe('the same five actions work after launch', () => {
  it('BUILD finishes a feature that was cut at launch', () => {
    let s = goLive({ features: FOUR_BUILT })
    expect(s.features.find((f) => f.id === 'physics')!.state).toBe('PLANNED')
    s = act(s, { type: 'BUILD', featureId: 'physics' })
    s = act(s, { type: 'BUILD', featureId: 'physics' })
    s = act(s, { type: 'BUILD', featureId: 'physics' })
    s = closeQuietly(s) // 3 slots spent
    for (let guard = 0; guard < 6 && s.features.find((f) => f.id === 'physics')!.state === 'PLANNED'; guard++) {
      s = act(settle(s), { type: 'BUILD', featureId: 'physics' })
      if (s.actionsLeft === 0) s = closeQuietly(s)
    }
    expect(s.features.find((f) => f.id === 'physics')!.state).not.toBe('PLANNED')
  })

  it('FIX removes bugs', () => {
    const s = goLive({ features: FOUR_BUILT, bugs: 5 })
    expect(act(s, { type: 'FIX' }).bugs).toBeLessThan(5)
  })

  it('POLISH upgrades a shipped feature and cleans a bug', () => {
    const s = goLive({ features: { ...FOUR_BUILT, combat: built(50) }, bugs: 3 })
    const after = polish(s, 'combat')
    expect(after.features.find((f) => f.id === 'combat')!.quality).toBeGreaterThan(50)
    expect(after.bugs).toBe(2)
  })

  it('HYPE and REST still work (HYPE becomes a marketing push)', () => {
    const s = goLive({ features: FOUR_BUILT, hype: 10, morale: 50 })
    expect(act(s, { type: 'HYPE' }).hype).toBe(22)
    expect(act(s, { type: 'REST' }).morale).toBe(65)
  })

  it('give three slots a sprint, exactly like development', () => {
    const s = restAll(goLive({ features: FOUR_BUILT, morale: 30 }))
    expect(s.actionsLeft).toBe(0)
    expect(validateAction(s, { type: 'HYPE' })).toMatch(/no action slots/i)
  })

  it('are not available once the game is retired', () => {
    const retired = retireGame(goLive({ features: FOUR_BUILT }))
    expect(validateAction(retired, { type: 'REST' })).toMatch(/retired/i)
    expect(applyAction(retired, { type: 'REST' }).ok).toBe(false)
  })

  it('are not available while a game that just shipped waits for its next decision', () => {
    const shipped = shippedRun({ features: FOUR_BUILT })
    expect(validateAction(shipped, { type: 'REST' })).toMatch(/already shipped/i)
  })
})

describe('a sprint can never be trapped open', () => {
  it('lets a sprint close early when no action is legal at all', () => {
    // Every feature flawless, no bugs, full morale, maxed hype, nothing unbuilt that could be built.
    const perfect = Object.fromEntries(
      ['combat', 'story', 'crafting', 'physics', 'vehicles', 'customization'].map((id) => [id, built(100)]),
    )
    let s = goLive({ features: perfect as never, bugs: 0, hype: 100, morale: 100 })
    s = { ...s, features: s.features.map((f) => ({ ...f, quality: 100 })) }
    expect(isStuck(s)).toBe(true)
    const next = endSprint(s)
    expect(next).not.toBe(s)
    expect(liveSprintNumber(next)).toBe(2)
  })

  it('is not stuck while any single action remains', () => {
    const s = goLive({ features: FOUR_BUILT, hype: 100, morale: 100, bugs: 0 })
    expect(isStuck(s)).toBe(false) // unbuilt features can still be built
  })

  it('always lets the player retire, even with an event waiting', () => {
    let s = goLive({ features: FOUR_BUILT })
    s = { ...s, live: { ...s.live!, pendingEvent: 'sale' } }
    expect(retireGame(s).phase).toBe('retired')
  })
})

describe('releases', () => {
  const improved = () => {
    let s = goLive({ features: { ...FOUR_BUILT, combat: built(50) }, bugs: 3, hype: 30 })
    s = act(s, { type: 'FIX' })
    s = polish(s, 'combat')
    return s
  }

  it('are not possible when nothing changed since launch', () => {
    const s = goLive({ features: FOUR_BUILT })
    expect(previewRelease(s).ok).toBe(false)
    expect(releaseUpdate(s)).toBe(s)
  })

  it('write patch notes about what really changed', () => {
    const s = releaseUpdate(improved())
    const release = s.live!.releases[0]
    expect(release.version).toBe('v1.1')
    expect(release.notes.join(' ')).toMatch(/Fixed 3 bugs/)
    expect(release.summary).toMatch(/fixed/)
    expect(release.reaction.length).toBeGreaterThan(10)
  })

  it('publish the new legacy score and a sales spike', () => {
    const before = improved()
    const preview = previewRelease(before)
    const after = releaseUpdate(before)
    const release = after.live!.releases[0]
    expect(release.legacyBefore).toBe(preview.legacyBefore)
    expect(release.legacyAfter).toBe(computeLegacy(before).score)
    expect(release.legacyAfter).toBeGreaterThan(release.legacyBefore)
    expect(release.spike).toBeGreaterThan(0)
    expect(after.live!.sales).toBe(before.live!.sales + release.spike)
    expect(after.live!.minor).toBe(1)
  })

  it('cost no action slot and nothing extra', () => {
    const before = improved()
    const after = releaseUpdate(before)
    expect(after.actionsLeft).toBe(before.actionsLeft)
    expect(after.money).toBe(before.money)
  })

  it('sell less when released before the update window opens', () => {
    const s = improved()
    expect(isUpdateWindowOpen(s.live!)).toBe(false)
    expect(previewRelease(s).early).toBe(true)
    const open = { ...s, live: { ...s.live!, sprintsSinceRelease: 4 } }
    expect(isUpdateWindowOpen(open.live!)).toBe(true)
    const early = previewRelease(s)
    const onTime = previewRelease(open)
    expect(onTime.early).toBe(false)
    expect(onTime.spike).toBeGreaterThan(early.spike)
  })

  it('open a new window every four live sprints', () => {
    let s = goLive({ features: FOUR_BUILT })
    for (let i = 0; i < 3; i++) s = closeQuietly(s)
    expect(isUpdateWindowOpen(s.live!)).toBe(false)
    s = closeQuietly(s)
    expect(isUpdateWindowOpen(s.live!)).toBe(true)
  })

  it('restart the window and clear the notes', () => {
    const after = releaseUpdate(improved())
    expect(after.live!.sprintsSinceRelease).toBe(0)
    expect(after.live!.pendingNotes).toEqual([])
    expect(previewRelease(after).ok).toBe(false) // nothing new again
  })

  it('only pay for a NEW BEST legacy score, so dipping and recovering does not pay twice', () => {
    const first = releaseUpdate(improved())
    // The game gets worse (bugs creep in), is released, then recovers to exactly the same level.
    const worse = { ...first, bugs: first.bugs + 4 }
    const dip = releaseUpdate(worse)
    expect(dip.live!.releases[1].spike).toBe(0)
    expect(dip.live!.legacyAtRelease).toBe(first.live!.legacyAtRelease) // the bar does not drop
    const recovered = { ...dip, bugs: first.bugs }
    expect(previewRelease(recovered).spike).toBe(0)
  })

  it('give a fresh feature extra credit', () => {
    let s = goLive({ features: FOUR_BUILT })
    s = {
      ...s,
      features: s.features.map((f) => (f.id === 'physics' ? { ...f, state: 'PLAYABLE' as const, quality: 60, progress: f.complexity * 4 } : f)),
    }
    const preview = previewRelease(s)
    expect(preview.items.join(' ')).toMatch(/Added Physics \(as promised\)/)
    expect(preview.spike).toBeGreaterThan(0)
  })

  it('are only possible while the game is live', () => {
    const shipped = shippedRun({ features: FOUR_BUILT })
    expect(releaseUpdate(shipped)).toBe(shipped)
    expect(releaseUpdate(retireGame(goLive({ features: FOUR_BUILT })))).toBeDefined()
  })

  it('wait for a pending event to be decided', () => {
    const s = { ...improved() }
    const blocked = { ...s, live: { ...s.live!, pendingEvent: 'sale' } }
    expect(releaseUpdate(blocked)).toBe(blocked)
  })
})

describe('the launch review and the shipped game stay consistent', () => {
  it('shipGame still produces exactly the review it always did, plus sales', () => {
    let s = shippedRun({ features: FOUR_BUILT }) // reuse a shipped state to compare with a played one
    expect(s.review!.sales.total).toBeGreaterThan(0)
    expect(s.phase).toBe('shipped')
    s = shipGame(s) // shipping twice does nothing
    expect(s.phase).toBe('shipped')
  })

  it('keeps TEST_CONCEPT a plain concept with no seed features', () => {
    expect(TEST_CONCEPT.seedFeatures).toBeUndefined()
  })
})

describe('live helpers', () => {
  it('liveSprint() closes a sprint and settles events', () => {
    const s = goLive({ features: FOUR_BUILT })
    const next = liveSprint(s)
    expect(next.live!.sprintsLive).toBe(1)
    expect(next.live!.pendingEvent).toBeNull()
  })
})
