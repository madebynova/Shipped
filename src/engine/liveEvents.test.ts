import { describe, expect, it } from 'vitest'
import {
  EVENT_CHANCE,
  EVENT_COOLDOWN,
  LIVE_EVENTS,
  applyAction,
  cancelPromise,
  computeLegacy,
  computeReview,
  endSprint,
  findLiveEvent,
  promiseAge,
  releaseUpdate,
  resolveEvent,
  unresolvedPromises,
  validateAction,
  whyCannotChoose,
} from './index'
import type { Concept, RunState } from './index'
import { maybeStartEvent } from './liveEvents'
import { nextFloat } from './rng'
import { TEST_CONCEPT } from './testing/bots'
import { FOUR_BUILT, act, built, goLive, polish } from './testing/helpers'

/** A seed whose very next roll satisfies the test. (The roll decides whether an event happens.) */
function rngWhere(want: (roll: number) => boolean): number {
  for (let seed = 1; seed < 20000; seed++) if (want(nextFloat(seed).value)) return seed
  throw new Error('no such seed')
}

/** A live game whose next sprint-close is guaranteed to roll an event (or guaranteed not to). */
const eventful = (s: RunState): RunState => ({ ...s, rng: rngWhere((r) => r < EVENT_CHANCE) })
const quiet = (s: RunState): RunState => ({ ...s, rng: rngWhere((r) => r >= EVENT_CHANCE) })

/** Put a specific event on the table. */
const withEvent = (s: RunState, id: string): RunState => ({ ...s, live: { ...s.live!, pendingEvent: id } })

/** A live game after a couple of sprints, in a state where every event could happen. */
function lively(): RunState {
  const concept: Concept = { ...TEST_CONCEPT, seedFeatures: ['combat', 'physics'] }
  let s = goLive({ features: { ...FOUR_BUILT, combat: built(50) }, concept, bugs: 5, hype: 40, money: 500 })
  s = { ...s, morale: 40, live: { ...s.live!, sprintsLive: 5, sprintsSinceRelease: 5 } }
  // a release so 'rereview' is possible, and an improved game
  s = act(s, { type: 'FIX' })
  s = polish(polish(s, 'combat'), 'combat')
  s = releaseUpdate(s)
  return { ...s, money: 500, morale: 40 }
}

describe('the live events', () => {
  it('has the eight events from the design', () => {
    expect(LIVE_EVENTS.map((e) => e.id).sort()).toEqual(
      ['burnout', 'demand', 'driver', 'modders', 'rereview', 'rival', 'sale', 'streamer'].sort(),
    )
  })

  it('gives every event a kicker, a title, and one to three choices', () => {
    for (const event of LIVE_EVENTS) {
      expect(event.kicker.length, event.id).toBeGreaterThan(2)
      expect(event.title.length, event.id).toBeGreaterThan(5)
      expect(event.choices.length, event.id).toBeGreaterThanOrEqual(2)
      expect(event.choices.length, event.id).toBeLessThanOrEqual(3)
      expect(new Set(event.choices.map((c) => c.id)).size, event.id).toBe(event.choices.length)
    }
  })

  it('always leaves a free choice, so a broke studio can never be trapped by an event', () => {
    for (const event of LIVE_EVENTS) {
      expect(event.choices.some((c) => !c.cost), event.id).toBe(true)
    }
  })

  it('explains every choice in words', () => {
    for (const event of LIVE_EVENTS) {
      for (const choice of event.choices) {
        expect(choice.label.length, `${event.id}/${choice.id} label`).toBeGreaterThan(3)
        expect(choice.hint.length, `${event.id}/${choice.id} hint`).toBeGreaterThan(10)
        expect(choice.result.length, `${event.id}/${choice.id} result`).toBeGreaterThan(10)
      }
    }
  })

  it('writes body text from the real state', () => {
    const s = lively()
    for (const event of LIVE_EVENTS) {
      const body = event.body(s)
      expect(body.length, event.id).toBeGreaterThanOrEqual(1)
      for (const line of body) expect(line, event.id).not.toMatch(/undefined|NaN|\[object/)
    }
    expect(findLiveEvent('modders')!.body(s).join(' ')).toContain(String(s.bugs))
    expect(findLiveEvent('burnout')!.body(s).join(' ')).toContain(String(s.morale))
  })

  it('looks events up by id', () => {
    expect(findLiveEvent('rival')!.title).toMatch(/rival/i)
    expect(findLiveEvent('nope')).toBeUndefined()
    expect(findLiveEvent(null)).toBeUndefined()
  })
})

describe('when an event can happen', () => {
  const when = (id: string, s: RunState) => findLiveEvent(id)!.when(s)

  it('modders need some bugs', () => {
    expect(when('modders', { ...lively(), bugs: 2 })).toBe(false)
    expect(when('modders', { ...lively(), bugs: 3 })).toBe(true)
  })

  it('community demand needs an unbuilt promise, a couple of sprints in', () => {
    const s = lively()
    expect(unresolvedPromises(s)).toEqual(['physics'])
    expect(when('demand', s)).toBe(true)
    expect(when('demand', { ...s, live: { ...s.live!, sprintsLive: 1 } })).toBe(false)
    expect(when('demand', cancelPromise(s, 'physics'))).toBe(false)
  })

  it('burnout needs a tired team', () => {
    expect(when('burnout', { ...lively(), morale: 46 })).toBe(false)
    expect(when('burnout', { ...lively(), morale: 45 })).toBe(true)
  })

  it('a critic needs a release and a clearly better game', () => {
    const s = lively()
    expect(computeLegacy(s).score).toBeGreaterThanOrEqual(s.live!.launchScore + 6)
    expect(when('rereview', s)).toBe(true)
    expect(when('rereview', goLive({ features: FOUR_BUILT }))).toBe(false)
  })

  it('a streamer only finds a game that is worth watching', () => {
    const s = lively()
    expect(when('streamer', s)).toBe(true)
    const bad = { ...s, features: s.features.map((f) => ({ ...f, quality: 10 })), bugs: 30 }
    expect(when('streamer', bad)).toBe(false)
  })

  it('nothing happens in the very first live sprint', () => {
    const fresh = goLive({ features: FOUR_BUILT, bugs: 5 })
    for (const id of ['streamer', 'demand', 'sale', 'rival', 'driver', 'rereview']) expect(when(id, fresh), id).toBe(false)
  })
})

describe('picking an event at the start of a live sprint', () => {
  it('can leave a sprint quiet', () => {
    const s = maybeStartEvent(quiet(lively()))
    expect(s.live!.pendingEvent).toBeNull()
  })

  it('can raise an event that fits the situation, and writes it in the log', () => {
    const s = maybeStartEvent(eventful(lively()))
    expect(s.live!.pendingEvent).not.toBeNull()
    expect(findLiveEvent(s.live!.pendingEvent)!.when(lively())).toBe(true)
    expect(s.log.at(-1)!.text).toMatch(/Something is happening/)
    expect(s.live!.eventHistory).toHaveLength(1)
  })

  it('is deterministic: the same state always raises the same event', () => {
    const a = maybeStartEvent(eventful(lively()))
    const b = maybeStartEvent(eventful(lively()))
    expect(a.live!.pendingEvent).toBe(b.live!.pendingEvent)
    expect(a).toEqual(b)
  })

  it('never stacks a second event on top of a waiting one', () => {
    const waiting = withEvent(eventful(lively()), 'sale')
    expect(maybeStartEvent(waiting)).toBe(waiting)
  })

  it('does not repeat the same event within its cooldown', () => {
    const s = eventful(lively())
    const first = maybeStartEvent(s)
    const id = first.live!.pendingEvent!
    const again = maybeStartEvent({
      ...eventful(lively()),
      live: { ...lively().live!, eventHistory: [{ id, sprint: 5 }] },
    })
    // Same moment, so the one that just happened is off the table (others may still come up).
    expect(again.live!.pendingEvent).not.toBe(id)
    // After the cooldown has passed it can come back.
    const later = { ...lively().live!, sprintsLive: 5 + EVENT_COOLDOWN, eventHistory: [{ id, sprint: 5 }] }
    const allowed = LIVE_EVENTS.filter((e) => e.when({ ...lively(), live: later }))
    expect(allowed.map((e) => e.id)).toContain(id)
  })

  it('lets the rival sequel happen only once per game', () => {
    const base = lively()
    const seen = { ...base, live: { ...base.live!, sprintsLive: 20, eventHistory: [{ id: 'rival', sprint: 1 }] } }
    let sawRival = false
    for (let seed = 1; seed < 400; seed++) {
      const next = maybeStartEvent({ ...seen, rng: seed })
      if (next.live!.pendingEvent === 'rival') sawRival = true
    }
    expect(sawRival).toBe(false)
  })

  it('raises events at the start of live sprints through the normal sprint loop', () => {
    let s = eventful(goLive({ features: FOUR_BUILT, bugs: 5, morale: 30, money: 400 }))
    while (s.actionsLeft > 0) s = act(s, { type: 'REST' })
    // Events are rolled when a sprint closes; across many seeds at least some close with one waiting.
    let withEventCount = 0
    for (let seed = 1; seed < 60; seed++) {
      const next = endSprint({ ...s, rng: seed })
      if (next.live!.pendingEvent) withEventCount++
    }
    expect(withEventCount).toBeGreaterThan(5)
    expect(withEventCount).toBeLessThan(55)
  })
})

describe('an event waiting for a decision', () => {
  const waiting = () => withEvent(lively(), 'sale')

  it('blocks every action until it is decided', () => {
    const s = waiting()
    for (const type of ['FIX', 'HYPE', 'REST'] as const) {
      expect(validateAction(s, { type })).toMatch(/event/i)
      expect(applyAction(s, { type }).ok).toBe(false)
    }
  })

  it('blocks closing the sprint', () => {
    let s = waiting()
    s = { ...s, actionsLeft: 0 }
    expect(endSprint(s)).toBe(s)
  })

  it('lets the player act again once decided', () => {
    const next = resolveEvent({ ...waiting(), actionsLeft: 3 }, 'hold')
    expect(next.live!.pendingEvent).toBeNull()
    expect(validateAction(next, { type: 'HYPE' })).toBeNull()
  })

  it('ignores choices that do not exist, or when nothing is waiting', () => {
    const s = waiting()
    expect(resolveEvent(s, 'banana')).toBe(s)
    const none = lively()
    expect(resolveEvent(none, 'hold')).toBe(none)
    expect(whyCannotChoose(none, 'hold')).toMatch(/no event/i)
    expect(whyCannotChoose(s, 'banana')).toMatch(/not one of/i)
  })

  it('records the decision in the history and the log', () => {
    const before = waiting()
    const next = resolveEvent(before, 'hold')
    expect(next.history.at(-1)).toEqual({ kind: 'choice', sprint: before.sprint, eventId: 'sale', choiceId: 'hold' })
    expect(next.log.at(-1)!.text).toBe(findLiveEvent('sale')!.choices.find((c) => c.id === 'hold')!.result)
  })

  it('refuses a choice the account cannot pay for, and says why', () => {
    const poor = { ...withEvent(lively(), 'modders'), money: 10 }
    expect(whyCannotChoose(poor, 'patch')).toMatch(/\$30/)
    expect(resolveEvent(poor, 'patch')).toBe(poor)
    expect(resolveEvent(poor, 'embrace').live!.pendingEvent).toBeNull() // the free choice still works
  })
})

describe('what the choices do', () => {
  const run = (event: string, choice: string, patch: Partial<RunState> = {}) => {
    const before = { ...withEvent(lively(), event), ...patch }
    return { before, after: resolveEvent(before, choice) }
  }

  it('modders: EMBRACE gives lasting originality, fewer bugs, hype, and a patch note', () => {
    const { before, after } = run('modders', 'embrace', { bugs: 6 })
    expect(after.live!.originalityBonus).toBe(before.live!.originalityBonus + 4)
    expect(after.bugs).toBe(before.bugs - 2)
    expect(after.hype).toBe(before.hype + 8)
    expect(after.live!.pendingNotes.join(' ')).toMatch(/wall-jump/)
    // the originality really reaches the score, and the launch review is untouched
    expect(computeReview(after).originality).toBe(computeReview(before).originality + 4)
    expect(after.review).toEqual(before.review)
  })

  it('modders: PATCH costs money and morale but removes more bugs', () => {
    const { before, after } = run('modders', 'patch', { bugs: 6 })
    expect(after.money).toBe(before.money - 30)
    expect(after.bugs).toBe(before.bugs - 4)
    expect(after.morale).toBe(before.morale - 3)
  })

  it('modders: embracing again stacks, but originality can never pass 100', () => {
    const maxed = { ...withEvent(lively(), 'modders'), live: { ...lively().live!, originalityBonus: 200, pendingEvent: 'modders' } }
    expect(computeReview(maxed).originality).toBeLessThanOrEqual(100)
  })

  it('streamer: THANK-YOU is free; SPONSOR costs $40 and does twice as much', () => {
    const thanks = run('streamer', 'thanks')
    const sponsor = run('streamer', 'sponsor')
    expect(thanks.after.money).toBe(thanks.before.money)
    expect(sponsor.after.money).toBe(sponsor.before.money - 40)
    expect(thanks.after.hype).toBe(thanks.before.hype + 12)
    expect(sponsor.after.hype).toBe(sponsor.before.hype + 25)
    const gainThanks = thanks.after.live!.sales - thanks.before.live!.sales
    const gainSponsor = sponsor.after.live!.sales - sponsor.before.live!.sales
    expect(gainThanks).toBeGreaterThan(0)
    expect(gainSponsor).toBeGreaterThan(gainThanks)
  })

  it('demand: REASSURE restarts the promise clock, CANCEL cancels, QUIET costs hype', () => {
    const before = withEvent(lively(), 'demand')
    expect(promiseAge(before, 'physics')).toBe(5)
    const reassure = resolveEvent(before, 'reassure')
    expect(promiseAge(reassure, 'physics')).toBe(0)
    expect(reassure.hype).toBe(before.hype + 6)
    expect(reassure.morale).toBe(before.morale - 2)

    const cancel = resolveEvent(before, 'cancel')
    expect(cancel.live!.cancelled).toEqual(['physics'])
    // the choice is what gets recorded, not a second 'cancel' entry
    expect(cancel.history.filter((e) => e.kind === 'cancel')).toHaveLength(0)
    expect(cancel.history.at(-1)).toMatchObject({ kind: 'choice', choiceId: 'cancel' })

    const quietChoice = resolveEvent(before, 'quiet')
    expect(quietChoice.hype).toBe(before.hype - 5)
    expect(promiseAge(quietChoice, 'physics')).toBe(5)
  })

  it('sale: JOIN pays cash now and costs hype; KEEP THE PRICE costs nothing', () => {
    const before = withEvent(lively(), 'sale')
    const join = resolveEvent(before, 'join')
    expect(join.money).toBe(before.money + before.live!.sales + 20)
    expect(join.live!.totalSales).toBe(before.live!.totalSales + before.live!.sales + 20)
    expect(join.hype).toBe(before.hype - 5)
    const hold = resolveEvent(before, 'hold')
    expect(hold.money).toBe(before.money)
    expect(hold.hype).toBe(before.hype + 3)
  })

  it('rival: each answer changes sales differently; CHALLENGE is a gamble on your legacy score', () => {
    const before = withEvent(lively(), 'rival')
    const sales = before.live!.sales
    expect(resolveEvent(before, 'hold').live!.sales).toBe(Math.round(sales * 0.82))
    const outshine = resolveEvent(before, 'outshine')
    expect(outshine.money).toBe(before.money - 40)
    expect(outshine.live!.sales).toBe(Math.round(sales * 0.95))
    expect(outshine.hype).toBe(before.hype + 12)

    const strong = { ...before }
    const weak = {
      ...before,
      bugs: 30,
      features: before.features.map((f) => (f.state !== 'PLANNED' ? { ...f, quality: 20, state: 'PLAYABLE' as const } : f)),
    }
    expect(computeLegacy(strong).score).toBeGreaterThanOrEqual(70)
    expect(computeLegacy(weak).score).toBeLessThan(70)
    expect(resolveEvent(strong, 'challenge').hype).toBe(before.hype + 15)
    expect(resolveEvent(weak, 'challenge').live!.sales).toBe(Math.round(sales * 0.75))
  })

  it('burnout: RETREAT restores morale for money; PUSH THROUGH costs morale and quality', () => {
    const retreat = run('burnout', 'retreat')
    expect(retreat.after.morale).toBe(retreat.before.morale + 22)
    expect(retreat.after.money).toBe(retreat.before.money - 35)
    const push = run('burnout', 'push')
    expect(push.after.morale).toBe(push.before.morale - 6)
    expect(push.after.bugs).toBe(push.before.bugs + 2)
  })

  it('critic: both answers are good, one is louder', () => {
    const shout = run('rereview', 'shout')
    const humble = run('rereview', 'humble')
    expect(shout.after.hype).toBe(shout.before.hype + 18)
    expect(humble.after.hype).toBe(humble.before.hype + 8)
    expect(humble.after.morale).toBe(humble.before.morale + 3)
    expect(shout.after.live!.sales).toBeGreaterThan(shout.before.live!.sales)
  })

  it('driver: HOTFIX costs money; WAIT costs bugs and hype', () => {
    const hotfix = run('driver', 'hotfix')
    expect(hotfix.after.money).toBe(hotfix.before.money - 30)
    expect(hotfix.after.bugs).toBe(hotfix.before.bugs)
    const wait = run('driver', 'wait')
    expect(wait.after.bugs).toBe(wait.before.bugs + 3)
    expect(wait.after.hype).toBe(wait.before.hype - 5)
  })
})

describe('every choice of every event leaves a legal game behind', () => {
  const situations: [string, RunState][] = [
    ['lively', lively()],
    ['broke-ish', { ...lively(), money: 31, hype: 0, morale: 3, bugs: 0 }],
    ['maxed out', { ...lively(), hype: 100, morale: 100, bugs: 60 }],
  ]

  for (const [name, state] of situations) {
    for (const event of LIVE_EVENTS) {
      for (const choice of event.choices) {
        it(`${name}: ${event.id} / ${choice.id}`, () => {
          const before = withEvent(state, event.id)
          if (whyCannotChoose(before, choice.id) !== null) return // unaffordable: the UI locks it
          const after = resolveEvent(before, choice.id)
          expect(after.live!.pendingEvent).toBeNull()
          expect(after.hype).toBeGreaterThanOrEqual(0)
          expect(after.hype).toBeLessThanOrEqual(100)
          expect(after.morale).toBeGreaterThanOrEqual(0)
          expect(after.morale).toBeLessThanOrEqual(100)
          expect(after.bugs).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(after.money)).toBe(true)
          expect(Number.isInteger(after.live!.sales)).toBe(true)
          expect(after.live!.sales).toBeGreaterThanOrEqual(0)
          expect(after.money).toBeGreaterThanOrEqual(before.money - (choice.cost ?? 0))
        })
      }
    }
  }
})
