import { describe, expect, it } from 'vitest'
import {
  BROKE_MORALE_PENALTY,
  applyAction,
  cancelPromise,
  computeLegacy,
  endSprint,
  launchUpdates,
  liveRunway,
  liveUpkeep,
  previewRelease,
  releaseUpdate,
  resolveEvent,
  retireGame,
  sprintEndEffects,
  validateAction,
} from './index'
import type { RunState } from './index'
import { TEST_CONCEPT, idleLive, playLive } from './testing/bots'
import { FOUR_BUILT, act, built, deepFreeze, goLive, polish, shippedRun } from './testing/helpers'

/** Spend every slot on quiet moves (rest while that is legal), so the build stays as it is. */
function restAll(state: RunState): RunState {
  let s = state
  while (s.actionsLeft > 0) s = act(s, idleMove(s))
  return s
}

/** Close the sprint, discarding any event so the money story stays clean. */
function close(state: RunState): RunState {
  const next = endSprint(state)
  return next.live?.pendingEvent ? { ...next, live: { ...next.live, pendingEvent: null } } : next
}

/** A rested live game whose account will read exactly `bank` once this sprint closes. */
function closingWith(bank: number, patch: Partial<RunState> = {}): RunState {
  const s = restAll({ ...goLive({ features: FOUR_BUILT, morale: 30 }), ...patch })
  const fx = sprintEndEffects(s)
  return { ...s, money: bank - fx.money }
}

describe('retiring a game', () => {
  it('straight from the review ends the run with the legacy equal to the launch', () => {
    const shipped = shippedRun({ features: FOUR_BUILT, bugs: 2 })
    const retired = retireGame(shipped)
    expect(retired.phase).toBe('retired')
    expect(retired.live).toBeNull()
    expect(retired.legacy!.score).toBe(shipped.review!.score)
    expect(retired.legacy!.launchScore).toBe(shipped.review!.score)
    expect(retired.legacy!.reason).toBe('retired')
    expect(retired.legacy!.totalSales).toBe(shipped.review!.sales.total)
    expect(retired.history.at(-1)).toEqual({ kind: 'retire', sprint: shipped.sprint })
  })

  it('in the middle of the live phase writes the final card with both scores', () => {
    let s = goLive({ features: { ...FOUR_BUILT, combat: built(50) }, bugs: 4 })
    s = act(s, { type: 'FIX' })
    s = polish(s, 'combat')
    s = releaseUpdate(s)
    const retired = retireGame(s)
    const card = retired.legacy!
    expect(retired.phase).toBe('retired')
    expect(retired.actionsLeft).toBe(0)
    expect(card.launchScore).toBe(s.review!.score)
    expect(card.score).toBe(computeLegacy(s).score)
    expect(card.score).toBeGreaterThan(card.launchScore) // the updates helped
    expect(card.reason).toBe('retired')
    expect(card.releases).toBe(1)
    expect(card.totalSales).toBe(s.live!.totalSales)
    expect(card.band).toBeDefined()
    expect(card.launchBand).toBe(s.review!.band)
  })

  it('keeps the launch review exactly as it was', () => {
    const shipped = shippedRun({ features: FOUR_BUILT, bugs: 2 })
    const retired = retireGame(restAll(goLive({ features: FOUR_BUILT, bugs: 2 })))
    expect(retired.review).toEqual(shipped.review)
  })

  it('is possible at any moment, even before a single live action', () => {
    expect(retireGame(goLive({ features: FOUR_BUILT })).phase).toBe('retired')
  })

  it('can be done once, and then nothing else can be done', () => {
    const retired = retireGame(goLive({ features: FOUR_BUILT }))
    expect(retireGame(retired)).toBe(retired)
    expect(endSprint(retired)).toBe(retired)
    expect(launchUpdates(retired)).toBe(retired)
    expect(releaseUpdate(retired)).toBe(retired)
    expect(resolveEvent(retired, 'hold')).toBe(retired)
    expect(cancelPromise(retired, 'physics')).toBe(retired)
    expect(applyAction(retired, { type: 'REST' }).ok).toBe(false)
    expect(validateAction(retired, { type: 'HYPE' })).toMatch(/retired/i)
  })

  it('does not exist for a game still in development', () => {
    const dev = { ...shippedRun({ features: FOUR_BUILT }), phase: 'developing' as const, review: null }
    expect(retireGame(dev)).toBe(dev)
  })
})

describe('running out of money: warning, then closure', () => {
  it('stays quiet while the account comfortably covers the next sprint', () => {
    const next = close(closingWith(500))
    expect(next.live!.warned).toBe(false)
    expect(next.phase).toBe('live')
    expect(next.log.some((l) => /WARNING/.test(l.text))).toBe(false)
  })

  it('warns one sprint ahead, while the account is still above zero', () => {
    const next = close(closingWith(5))
    expect(next.phase).toBe('live') // the game goes on
    expect(next.money).toBe(5)
    expect(next.live!.warned).toBe(true)
    expect(next.log.some((l) => /WARNING/.test(l.text) && l.tone === 'bad')).toBe(true)
    expect(liveRunway(next)).toBe(0)
  })

  it('closes the studio if the next sprint still cannot be paid, after that one warning', () => {
    const warned = close(closingWith(5))
    const second = close(restAll(warned))
    expect(second.phase).toBe('retired')
    expect(second.legacy!.reason).toBe('broke')
    expect(second.money).toBe(0)
    expect(second.legacy!.liveSprints).toBe(2)
    expect(second.log.at(-1)!.text).toMatch(/revenue account is empty/i)
  })

  it('writes a complete final card when the money runs out (both scores, nothing missing)', () => {
    const warned = close(closingWith(5))
    const end = close(restAll(warned))
    const card = end.legacy!
    expect(card.launchScore).toBe(end.review!.score)
    expect(card.score).toBeGreaterThanOrEqual(0)
    expect(card.score).toBeLessThanOrEqual(100)
    expect(card.totalSales).toBeGreaterThan(0)
    expect(end.actionsLeft).toBe(0)
  })

  it('gives an unpaid grace sprint if the money vanishes with no warning (e.g. an event)', () => {
    const before = closingWith(-10)
    expect(before.live!.warned).toBe(false)
    const fx = sprintEndEffects(before)
    expect(fx.notes.some((n) => /works unpaid/i.test(n.text))).toBe(true)
    const next = close(before)
    expect(next.phase).toBe('live') // not closed yet: it is the warning sprint
    expect(next.money).toBe(0)
    expect(next.live!.warned).toBe(true)
    expect(next.morale).toBeLessThanOrEqual(before.morale + fx.morale)
    expect(fx.morale).toBeLessThanOrEqual(-BROKE_MORALE_PENALTY)
  })

  it('then closes the studio after the grace sprint if nothing changes', () => {
    const grace = close(closingWith(-10))
    expect(close(restAll(grace)).phase).toBe('retired')
  })

  it('works unpaid (weaker) during the warning sprint when the account is empty', () => {
    const grace = close(closingWith(-10))
    expect(grace.money).toBe(0)
    const rested = restAll(grace) // being broke does not stop you acting
    expect(rested.actionsLeft).toBe(0)
  })

  it('clears the warning once the account can cover the next sprint again', () => {
    const warned = close(closingWith(5))
    expect(warned.live!.warned).toBe(true)
    const funded = restAll({ ...warned, money: 800 })
    const next = close(funded)
    expect(next.phase).toBe('live')
    expect(next.live!.warned).toBe(false)
  })

  it('can be rescued during the warning sprint by a release that brings in sales', () => {
    let s = goLive({ features: { ...FOUR_BUILT, combat: built(50) }, bugs: 3, hype: 0, morale: 30 })
    s = act(s, { type: 'FIX' })
    s = polish(s, 'combat')
    s = act(s, { type: 'REST' })
    const fx = sprintEndEffects(s)
    s = { ...s, money: 5 - fx.money }
    const warned = close(s)
    expect(warned.live!.warned).toBe(true)
    // In the warning sprint the player releases an update: sales go up and the runway grows.
    const bugsFixed = act(warned, { type: 'FIX' })
    const improved = polish(bugsFixed, 'combat')
    const preview = previewRelease(improved)
    expect(preview.ok).toBe(true)
    const released = releaseUpdate(improved)
    expect(released.live!.sales).toBeGreaterThan(improved.live!.sales)
    expect(liveRunway(released)).toBeGreaterThanOrEqual(liveRunway(improved))
  })

  it('always warns at least one sprint before it closes the studio (never straight from "fine")', () => {
    // Play several idle games to the end, watching the flag at every close.
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let s = launchUpdates(shippedRun({ features: FOUR_BUILT, seed, money: 115 }))
      let warnedBefore = false
      for (let guard = 0; guard < 80 && s.phase === 'live'; guard++) {
        if (s.live!.pendingEvent) {
          s = resolveEvent(s, firstFreeChoice(s))
          continue
        }
        while (s.actionsLeft > 0) s = act(s, idleMove(s))
        const warnedAtStart = s.live!.warned
        s = endSprint(s)
        if (s.phase === 'retired') {
          expect(s.legacy!.reason).toBe('broke')
          expect(warnedAtStart, `seed ${seed}: closed without a warning sprint`).toBe(true)
          break
        }
        warnedBefore = warnedBefore || s.live!.warned
      }
      expect(s.phase).toBe('retired')
      expect(warnedBefore).toBe(true)
    }
  })

  it('always ends: an idle live game eventually runs out of money and closes, with no crash', () => {
    for (const seed of [1, 2, 3]) {
      const shipped = shippedRun({ features: FOUR_BUILT, seed })
      const end = playLive(shipped, idleLive)
      expect(end.phase).toBe('retired')
      expect(end.legacy!.reason).toBe('broke')
      expect(end.live!.sprintsLive).toBeGreaterThan(3)
    }
  })

  it('treats a high-scope game as more expensive to keep alive', () => {
    const lean = goLive({ features: { combat: built(72), story: built(72) } })
    const big = goLive({ features: { ...FOUR_BUILT, physics: built(72), vehicles: built(72) } })
    expect(sprintEndEffects(restAll({ ...big, morale: 30 })).upkeep).toBeGreaterThan(sprintEndEffects(restAll({ ...lean, morale: 30 })).upkeep!)
    expect(liveUpkeep('CRITICAL')).toBe(sprintEndEffects(restAll({ ...big, morale: 30 })).upkeep)
  })
})

describe('a game that has ended can never be reopened', () => {
  it('stays retired through every kind of ending', () => {
    const endings: RunState[] = [
      retireGame(shippedRun({ features: FOUR_BUILT })),
      retireGame(goLive({ features: FOUR_BUILT })),
      close(restAll(close(closingWith(5)))),
    ]
    for (const e of endings) {
      expect(e.phase).toBe('retired')
      expect(e.legacy).not.toBeNull()
      expect(endSprint(e)).toBe(e)
      expect(retireGame(e)).toBe(e)
    }
  })

  it('never mutates the state it was given', () => {
    const frozen = deepFreeze(goLive({ features: FOUR_BUILT, bugs: 3 }))
    expect(() => retireGame(frozen)).not.toThrow()
    expect(() => launchUpdates(deepFreeze(shippedRun({ features: FOUR_BUILT })))).not.toThrow()
    expect(() => endSprint(deepFreeze(restAll(goLive({ features: FOUR_BUILT, morale: 30 }))))).not.toThrow()
    expect(() => cancelPromise(deepFreeze(goLive({ features: FOUR_BUILT })), 'physics')).not.toThrow()
    expect(() => releaseUpdate(deepFreeze(act(goLive({ features: FOUR_BUILT, bugs: 3 }), { type: 'FIX' })))).not.toThrow()
  })
})

/* ---- small local helpers ------------------------------------------------------------------ */

function idleMove(state: RunState) {
  for (const a of [{ type: 'REST' }, { type: 'HYPE' }, { type: 'FIX' }] as const) {
    if (applyAction(state, a).ok) return a
  }
  return { type: 'BUILD', featureId: 'vehicles' } as const
}

function firstFreeChoice(state: RunState): string {
  const events = state.live!.pendingEvent!
  // every event has a free choice; take whichever comes first
  const free: Record<string, string> = {
    modders: 'embrace',
    streamer: 'thanks',
    demand: 'quiet',
    sale: 'hold',
    rival: 'hold',
    burnout: 'push',
    rereview: 'humble',
    driver: 'wait',
  }
  return free[events]
}

void TEST_CONCEPT
