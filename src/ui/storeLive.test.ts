import { describe, expect, it } from 'vitest'
import { CONCEPTS, beginnerConcepts, findConcept } from '../content/concepts'
import { TUTORIAL_PASS_SCORE, TUTORIAL_RUN, promisedFeatures } from '../engine'
import type { Action } from '../engine'
import { balanced } from '../engine/testing/bots'
import type { Policy } from '../engine/testing/bots'
import { SAVE_KEY } from '../save'
import type { StorageLike } from '../save'
import { TUTORIAL_CONCEPT } from '../tutorial/script'
import { createGameStore } from './store'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  const storage: StorageLike = {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v
    },
  }
  return { storage, data }
}

const savedState = (data: Record<string, string>) => JSON.parse(data[SAVE_KEY] ?? '{}')
const returning = (extra: Record<string, unknown> = {}) =>
  memoryStorage({ [SAVE_KEY]: JSON.stringify({ tutorialCompleted: true, ...extra }) })

type Store = ReturnType<typeof createGameStore>
const FOUR = ['combat', 'story', 'crafting', 'customization'] as const

/** Play the development phase to the review screen, like the UI would. */
function playToReview(store: Store, policy: Policy) {
  for (let guard = 0; guard < 400 && store.getState().screen === 'game'; guard++) {
    const run = store.getState().run!
    if (run.actionsLeft === 0) {
      store.getState().closeSprint()
      continue
    }
    const choice = policy(run)
    if (choice === 'ship') store.getState().ship()
    else if (!store.getState().perform(choice).ok) throw new Error('illegal move in test')
  }
}

/** A returning player who has just shipped a decent four-feature game: the review is on screen. */
function shippedStore(extra: Record<string, unknown> = {}, random?: () => number) {
  const { storage, data } = returning(extra)
  const store = createGameStore(storage, random)
  store.getState().setConcept({ title: 'Iron Pulse', idea: 'A brutal physics-driven combat game where every hit matters.' })
  store.getState().startRun()
  playToReview(store, balanced({ features: [...FOUR] }))
  expect(store.getState().screen).toBe('review')
  return { store, data, storage }
}

/** Idle moves for the live phase: rest, hype or fix. */
function idle(store: Store): Action {
  const run = store.getState().run!
  for (const a of [{ type: 'REST' }, { type: 'HYPE' }, { type: 'FIX' }] as const) {
    if (store.getState().perform(a).ok) return a
  }
  throw new Error(`nothing legal at sprint ${run.sprint}`)
}

describe('PICK AN EXAMPLE', () => {
  it('loads a gallery concept into the form, with its seed features and vision', () => {
    const store = createGameStore(returning().storage)
    store.getState().pickConcept('cold-bite')
    const s = store.getState()
    expect(s.conceptId).toBe('cold-bite')
    expect(s.concept).toMatchObject({
      title: 'Cold Bite',
      genre: 'Survival',
      seedFeatures: ['crafting', 'story', 'physics'],
    })
    expect(s.concept.idea).toBe(findConcept('cold-bite')!.pitch)
    expect(s.concept.vision).toBeTruthy()
  })

  it('stays editable before starting, and the run uses what the player ended up with', () => {
    const store = createGameStore(returning().storage)
    store.getState().pickConcept('idol-ranch')
    store.getState().setConcept({ title: 'Idol Farm 2000', genre: 'Strategy' })
    store.getState().startRun()
    const run = store.getState().run!
    expect(store.getState().screen).toBe('game')
    expect(run.config.kind).toBe('full')
    expect(run.concept.title).toBe('Idol Farm 2000')
    expect(run.concept.genre).toBe('Strategy')
    expect(run.concept.seedFeatures).toEqual(['customization', 'story', 'crafting']) // the seed cards are kept
    expect(promisedFeatures(run.concept)).toEqual(['customization', 'story', 'crafting'])
  })

  it('starts a run correctly from every concept in the gallery', () => {
    for (const template of CONCEPTS) {
      const store = createGameStore(returning().storage)
      store.getState().pickConcept(template.id)
      store.getState().startRun()
      const run = store.getState().run!
      expect(run.concept.title, template.id).toBe(template.title)
      expect(run.concept.idea, template.id).toBe(template.pitch)
      expect(run.features, template.id).toHaveLength(6)
      expect(store.getState().screen, template.id).toBe('game')
    }
  })

  it('ignores an id that is not in the gallery', () => {
    const store = createGameStore(returning().storage)
    store.getState().setConcept({ title: 'Mine', idea: 'Mine too' })
    store.getState().pickConcept('does-not-exist')
    expect(store.getState().concept.title).toBe('Mine')
    expect(store.getState().conceptId).toBeNull()
  })
})

describe('ROLL RANDOM', () => {
  it('loads a concept chosen by the random function', () => {
    const store = createGameStore(returning().storage, () => 0)
    store.getState().rollConcept()
    expect(store.getState().conceptId).toBe(CONCEPTS[0].id)
    expect(store.getState().concept.title).toBe(CONCEPTS[0].title)
  })

  it('never rolls the concept that is already there (even when the random number would pick it again)', () => {
    const store = createGameStore(returning().storage, () => 0) // always wants the first concept
    let previous: string | null = null
    for (let i = 0; i < 6; i++) {
      store.getState().rollConcept()
      const now = store.getState().conceptId
      expect(now).not.toBe(previous)
      previous = now
    }
  })

  it('reaches the whole gallery as the random number moves', () => {
    const seen = new Set<string>()
    let n = 0
    const store = createGameStore(returning().storage, () => ((n++ * 0.137) % 1))
    for (let i = 0; i < 60; i++) {
      store.getState().rollConcept()
      seen.add(store.getState().conceptId!)
    }
    expect(seen.size).toBeGreaterThanOrEqual(10)
  })

  it('fills the form so the run can start straight away', () => {
    const store = createGameStore(returning().storage, () => 0.5)
    store.getState().rollConcept()
    store.getState().startRun()
    expect(store.getState().screen).toBe('game')
    expect(store.getState().run!.concept.title).toBe(store.getState().concept.title)
  })
})

describe('WRITE MY OWN', () => {
  it('keeps the text but lets go of the gallery concept (seed features, vision, card highlight)', () => {
    const store = createGameStore(returning().storage)
    store.getState().pickConcept('velvet-heist')
    store.getState().writeOwnConcept()
    const s = store.getState()
    expect(s.conceptId).toBeNull()
    expect(s.concept.title).toBe('Velvet Heist')
    expect(s.concept.seedFeatures).toBeUndefined()
    expect(s.concept.vision).toBeUndefined()
  })

  it('works exactly as before: type a title and an idea, pick a genre, start', () => {
    const store = createGameStore(returning().storage)
    store.getState().setConcept({ title: 'Handmade', idea: 'Something I wrote myself.', genre: 'Racing' })
    store.getState().startRun()
    expect(store.getState().run!.concept).toEqual({ title: 'Handmade', idea: 'Something I wrote myself.', genre: 'Racing' })
  })

  it('promises its genre signature features', () => {
    const store = createGameStore(returning().storage)
    store.getState().setConcept({ title: 'Handmade', idea: 'Something I wrote myself.', genre: 'Racing' })
    store.getState().startRun()
    expect(promisedFeatures(store.getState().run!.concept)).toEqual(['vehicles', 'physics'])
  })
})

describe('MY FIRST GAME picks from three beginner concepts', () => {
  const fresh = () => createGameStore(memoryStorage().storage)

  it('starts on Lantern Hollow, exactly like v0.0.2', () => {
    const store = fresh()
    expect(store.getState().concept).toEqual(TUTORIAL_CONCEPT)
    expect(store.getState().conceptId).toBe('lantern-hollow')
    store.getState().beginTutorial()
    expect(store.getState().concept.title).toBe('Lantern Hollow')
  })

  it('lets the player pick any of the three beginner concepts', () => {
    expect(beginnerConcepts()).toHaveLength(3)
    for (const template of beginnerConcepts()) {
      const store = fresh()
      store.getState().beginTutorial()
      store.getState().pickConcept(template.id)
      expect(store.getState().concept.title).toBe(template.title)
      store.getState().startRun()
      const run = store.getState().run!
      expect(run.config).toEqual(TUTORIAL_RUN)
      expect(run.concept.title).toBe(template.title)
    }
  })

  it('refuses a full-game concept until the tutorial is passed', () => {
    const store = fresh()
    store.getState().beginTutorial()
    store.getState().pickConcept('cold-bite')
    expect(store.getState().concept.title).toBe('Lantern Hollow')
    expect(store.getState().conceptId).toBe('lantern-hollow')
  })

  it('only rolls beginner concepts', () => {
    const beginnerIds = new Set(beginnerConcepts().map((c) => c.id))
    for (const r of [0, 0.2, 0.5, 0.8, 0.99]) {
      const store = createGameStore(memoryStorage().storage, () => r)
      store.getState().beginTutorial()
      store.getState().rollConcept()
      expect(beginnerIds.has(store.getState().conceptId!)).toBe(true)
    }
  })

  it('can be passed with each of the three concepts', () => {
    for (const template of beginnerConcepts()) {
      const store = fresh()
      store.getState().beginTutorial()
      store.getState().pickConcept(template.id)
      store.getState().startRun()
      playToReview(store, balanced({ features: [...FOUR] }))
      expect(store.getState().run!.review!.score, template.id).toBeGreaterThanOrEqual(TUTORIAL_PASS_SCORE)
      expect(store.getState().save.tutorialCompleted, template.id).toBe(true)
    }
  })

  it('unlocks the whole gallery once the tutorial is passed', () => {
    const store = fresh()
    store.getState().beginTutorial()
    store.getState().startRun()
    playToReview(store, balanced({ features: [...FOUR] }))
    store.getState().openStudio()
    store.getState().pickConcept('cold-bite')
    expect(store.getState().concept.title).toBe('Cold Bite')
  })

  it('still skips the tutorial for an old save, and offers the full gallery', () => {
    const { storage } = memoryStorage({
      [SAVE_KEY]: JSON.stringify({ version: 1, tutorialCompleted: true, theme: 'paper', archive: [{ title: 'Old', score: 61 }] }),
    })
    const store = createGameStore(storage)
    expect(store.getState().screen).toBe('concept')
    expect(store.getState().save.tutorialCompleted).toBe(true)
    store.getState().pickConcept('cold-bite')
    expect(store.getState().concept.title).toBe('Cold Bite')
    store.getState().startRun()
    expect(store.getState().run!.config.kind).toBe('full')
  })

  it('treats the very old "runs" save shape as a returning player too', () => {
    const { storage } = memoryStorage({ [SAVE_KEY]: JSON.stringify({ runs: [{ title: 'Legacy Game', score: 64 }] }) })
    const store = createGameStore(storage)
    expect(store.getState().screen).toBe('concept')
    expect(store.getState().save.archive[0]).toMatchObject({ title: 'Legacy Game', score: 64, legacyScore: 64 })
  })
})

describe('after the review: LAUNCH UPDATES or RETIRE GAME', () => {
  it('RETIRE GAME ends the run on the legacy card, with the legacy score equal to the launch score', () => {
    const { store, data } = shippedStore()
    const launch = store.getState().run!.review!.score
    store.getState().retire()
    const s = store.getState()
    expect(s.screen).toBe('legacy')
    expect(s.run!.phase).toBe('retired')
    expect(s.run!.legacy!.score).toBe(launch)
    expect(s.run!.legacy!.launchScore).toBe(launch)
    const entry = savedState(data).archive[0]
    expect(entry).toMatchObject({ score: launch, legacyScore: launch, complete: false })
  })

  it('LAUNCH UPDATES keeps the same game going, with the launch score recorded and untouched', () => {
    const { store, data } = shippedStore()
    const launch = store.getState().run!.review!.score
    store.getState().launchUpdates()
    const s = store.getState()
    expect(s.screen).toBe('game')
    expect(s.run!.phase).toBe('live')
    expect(s.run!.review!.score).toBe(launch)
    expect(s.save.archive).toHaveLength(1) // the same entry, not a second one
    expect(savedState(data).archive[0]).toMatchObject({ score: launch, legacyScore: launch })
  })

  it('does not offer updates for the tutorial game, and nothing is archived twice', () => {
    const store = createGameStore(memoryStorage().storage)
    store.getState().beginTutorial()
    store.getState().startRun()
    playToReview(store, balanced({ features: [...FOUR] }))
    expect(store.getState().save.archive).toHaveLength(1)
    store.getState().launchUpdates()
    expect(store.getState().screen).toBe('review')
    expect(store.getState().run!.phase).toBe('shipped')
    expect(store.getState().save.archive).toHaveLength(1)
  })

  it('a second RETIRE does nothing (no double archiving)', () => {
    const { store } = shippedStore()
    store.getState().retire()
    const run = store.getState().run
    store.getState().retire()
    expect(store.getState().run).toBe(run)
    expect(store.getState().save.archive).toHaveLength(1)
  })
})

describe('the live phase through the store', () => {
  function live() {
    const made = shippedStore()
    made.store.getState().launchUpdates()
    return made
  }

  /** Settle any waiting event with its first choice the account can pay for. */
  function settle(store: Store) {
    const run = store.getState().run!
    if (!run.live?.pendingEvent) return
    const event = run.live.pendingEvent
    for (const choice of ['hold', 'thanks', 'quiet', 'humble', 'wait', 'push', 'embrace', 'hold']) {
      const before = store.getState().run
      store.getState().decideEvent(choice)
      if (store.getState().run !== before) return
    }
    throw new Error(`could not settle ${event}`)
  }

  it('plays sprints with the same actions, and closing a sprint moves on', () => {
    const { store } = live()
    const first = store.getState().run!
    expect(first.sprint).toBeGreaterThan(first.live!.launchSprint)
    for (let i = 0; i < 3; i++) idle(store)
    store.getState().closeSprint()
    settle(store)
    expect(store.getState().screen).toBe('game')
    expect(store.getState().run!.live!.sprintsLive).toBe(1)
  })

  it('releases an update: patch notes shown, archive legacy updated, launch score untouched', () => {
    const { store, data } = live()
    const launch = store.getState().run!.review!.score
    // Make the game better so a release is possible: fix what there is, polish the weakest feature.
    for (let guard = 0; guard < 6 && !store.getState().run!.live!.pendingEvent; guard++) {
      const run = store.getState().run!
      if (run.actionsLeft === 0) break
      const weak = [...run.features].filter((f) => f.state !== 'PLANNED').sort((a, b) => a.quality - b.quality)[0]
      store.getState().perform({ type: 'POLISH', featureId: weak.id })
    }
    store.getState().release()
    const s = store.getState()
    expect(s.lastRelease).not.toBeNull()
    expect(s.lastRelease!.version).toBe('v1.1')
    expect(savedState(data).archive[0].score).toBe(launch)
    expect(savedState(data).archive[0].legacyScore).toBe(s.lastRelease!.legacyAfter)
    store.getState().dismissRelease()
    expect(store.getState().lastRelease).toBeNull()
  })

  it('refuses a release when nothing has changed', () => {
    const { store } = live()
    store.getState().release()
    expect(store.getState().lastRelease).toBeNull()
    expect(store.getState().run!.live!.releases).toHaveLength(0)
  })

  it('RETIRE in the middle of the live phase writes both scores into the archive, once', () => {
    const { store, data } = live()
    const launch = store.getState().run!.review!.score
    for (let i = 0; i < 3; i++) idle(store)
    store.getState().closeSprint()
    settle(store)
    store.getState().retire()
    const s = store.getState()
    expect(s.screen).toBe('legacy')
    expect(s.save.archive).toHaveLength(1)
    const entry = savedState(data).archive[0]
    expect(entry.score).toBe(launch) // permanent
    expect(entry.legacyScore).toBe(s.run!.legacy!.score)
    expect(entry.legacyBand).toBe(s.run!.legacy!.band)
    expect(s.run!.legacy!.reason).toBe('retired')
  })

  it('runs out of money gracefully: a warning first, then the final card, no crash', () => {
    const { store } = live()
    let sawWarning = false
    for (let guard = 0; guard < 400 && store.getState().screen === 'game'; guard++) {
      settle(store)
      const run = store.getState().run!
      if (run.live!.warned) sawWarning = true
      if (run.actionsLeft > 0) idle(store)
      else store.getState().closeSprint()
    }
    const s = store.getState()
    expect(sawWarning).toBe(true)
    expect(s.screen).toBe('legacy')
    expect(s.run!.legacy!.reason).toBe('broke')
  })

  it('cancels a promise: legacy drops a little and the archive follows', () => {
    const { store, data } = live()
    const open = store.getState().run!.live!.promises.map((p) => p.featureId)
    expect(open.length).toBeGreaterThan(0)
    const before = store.getState().run!.hype
    store.getState().cancelPromise(open[0])
    const s = store.getState()
    expect(s.run!.live!.cancelled).toEqual([open[0]])
    expect(s.run!.hype).toBe(Math.max(0, before - 10)) // cancelling costs 10 hype
    expect(savedState(data).archive[0].legacyScore).toBeLessThanOrEqual(savedState(data).archive[0].score)
    // cancelling again, or something that is not a promise, changes nothing
    const run = s.run
    store.getState().cancelPromise(open[0])
    expect(store.getState().run).toBe(run)
  })

  it('ignores decisions when no event is waiting', () => {
    const { store } = live()
    const run = store.getState().run
    store.getState().decideEvent('hold')
    expect(store.getState().run).toBe(run)
  })

  it('NEW RUN after a retired game starts a clean run, and its archive entry is separate', () => {
    const { store, data } = live()
    store.getState().retire()
    const firstId = store.getState().save.archive[0].id
    store.getState().newRun()
    expect(store.getState().screen).toBe('game')
    expect(store.getState().run!.sprint).toBe(1)
    expect(store.getState().run!.phase).toBe('developing')
    expect(store.getState().lastRelease).toBeNull()
    playToReview(store, balanced({ features: [...FOUR] }))
    store.getState().retire()
    const archive = savedState(data).archive
    expect(archive).toHaveLength(2)
    expect(archive[1].id).toBe(firstId) // the first game's entry is untouched
  })

  it('CHANGE CONCEPT from the legacy card goes back to the concept screen with the concept kept', () => {
    const { store } = live()
    store.getState().retire()
    store.getState().editConcept()
    expect(store.getState().screen).toBe('concept')
    expect(store.getState().concept.title).toBe('Iron Pulse')
  })
})
