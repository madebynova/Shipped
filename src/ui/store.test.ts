import { describe, expect, it } from 'vitest'
import { FULL_RUN, TUTORIAL_PASS_SCORE, TUTORIAL_RUN, TOTAL_SPRINTS } from '../engine'
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

/** A returning player: tutorial already passed. */
function returning(extra: Record<string, unknown> = {}) {
  return memoryStorage({ [SAVE_KEY]: JSON.stringify({ tutorialCompleted: true, ...extra }) })
}

const FOUR = ['combat', 'story', 'crafting', 'customization'] as const

/** Drive a run to the end through the store, like the UI would. */
function playOut(store: ReturnType<typeof createGameStore>, policy: Policy) {
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

const hypeThenShip: Policy = (s) => (s.sprint >= 4 ? 'ship' : ({ type: 'HYPE' } as Action))

/** Fresh player gets through the tutorial the way a sensible newcomer would. */
function passTutorial(store: ReturnType<typeof createGameStore>) {
  store.getState().beginTutorial()
  store.getState().startRun()
  playOut(store, balanced({ features: [...FOUR] }))
}

describe('a first-time player', () => {
  it('lands on the MY FIRST GAME welcome card, with the tutorial concept ready', () => {
    const store = createGameStore(memoryStorage().storage)
    const s = store.getState()
    expect(s.screen).toBe('welcome')
    expect(s.save.tutorialCompleted).toBe(false)
    expect(s.concept).toEqual(TUTORIAL_CONCEPT)
    expect(s.run).toBeNull()
  })

  it('moves to a prefilled concept screen, where the player can rename the game', () => {
    const store = createGameStore(memoryStorage().storage)
    store.getState().beginTutorial()
    expect(store.getState().screen).toBe('concept')
    expect(store.getState().concept.title).toBe(TUTORIAL_CONCEPT.title)
    store.getState().setConcept({ title: 'My Cozy Thing' })
    store.getState().startRun()
    expect(store.getState().run!.concept.title).toBe('My Cozy Thing')
  })

  it('can only start the tutorial run: 6 sprints, 4 cards', () => {
    const store = createGameStore(memoryStorage().storage)
    store.getState().beginTutorial()
    store.getState().startRun()
    const run = store.getState().run!
    expect(run.config).toEqual(TUTORIAL_RUN)
    expect(run.config.totalSprints).toBe(6)
    expect(run.features).toHaveLength(4)
    expect(store.getState().screen).toBe('game')
  })

  it('cannot reach the full game by any route until the tutorial is passed', () => {
    const store = createGameStore(memoryStorage().storage)
    // skip the welcome card, and try the concept / new run / edit routes repeatedly
    store.getState().setConcept({ title: 'Sneaky', idea: 'Trying the full game' })
    store.getState().startRun()
    expect(store.getState().run!.config.kind).toBe('tutorial')
    store.getState().editConcept()
    store.getState().startRun()
    expect(store.getState().run!.config.kind).toBe('tutorial')
    store.getState().newRun()
    expect(store.getState().run!.config.kind).toBe('tutorial')
  })

  it('sees the first team tip before their first action', () => {
    const store = createGameStore(memoryStorage().storage)
    store.getState().beginTutorial()
    store.getState().startRun()
    expect(store.getState().tutorial.activeTip?.id).toBe('tip-actions')
    expect(store.getState().tutorial.activeEvent).toBeNull()
  })
})

describe('passing the tutorial', () => {
  it('unlocks the full game, saves it, and archives the run as TUTORIAL', () => {
    const { storage, data } = memoryStorage()
    const store = createGameStore(storage)
    passTutorial(store)

    const s = store.getState()
    expect(s.screen).toBe('review')
    expect(s.run!.config.kind).toBe('tutorial')
    expect(s.run!.review!.score).toBeGreaterThanOrEqual(TUTORIAL_PASS_SCORE)
    expect(s.save.tutorialCompleted).toBe(true)

    // persisted
    expect(savedState(data).tutorialCompleted).toBe(true)
    expect(savedState(data).archive[0]).toMatchObject({ kind: 'tutorial', title: TUTORIAL_CONCEPT.title })
  })

  it('opens the studio with a blank concept and then runs the real game', () => {
    const store = createGameStore(memoryStorage().storage)
    passTutorial(store)
    store.getState().openStudio()
    expect(store.getState().screen).toBe('concept')
    expect(store.getState().concept.title).toBe('')
    store.getState().setConcept({ title: 'Iron Pulse', idea: 'A brutal combat game.' })
    store.getState().startRun()
    const run = store.getState().run!
    expect(run.config).toEqual(FULL_RUN)
    expect(run.config.totalSprints).toBe(TOTAL_SPRINTS)
    expect(run.features).toHaveLength(6)
    expect(run.money).toBe(500)
  })

  it('shows no tutorial help at all in the full game', () => {
    const store = createGameStore(memoryStorage().storage)
    passTutorial(store)
    store.getState().openStudio()
    store.getState().setConcept({ title: 'Iron Pulse', idea: 'A brutal combat game.' })
    store.getState().startRun()
    for (let sprint = 1; sprint <= 3; sprint++) {
      expect(store.getState().tutorial).toEqual({ seen: [], activeEvent: null, activeTip: null })
      playOut(store, () => 'ship') // never legal this early; loop guard handles it
      break
    }
    const run = store.getState().run!
    expect(run.sprint).toBe(1)
    store.getState().perform({ type: 'BUILD', featureId: 'combat' })
    expect(store.getState().tutorial.activeTip).toBeNull()
    expect(store.getState().tutorial.activeEvent).toBeNull()
  })
})

describe('failing the tutorial', () => {
  it('keeps the full game locked, still records the attempt, and offers a retry', () => {
    const { storage, data } = memoryStorage()
    const store = createGameStore(storage)
    store.getState().beginTutorial()
    store.getState().startRun()
    playOut(store, hypeThenShip)

    expect(store.getState().screen).toBe('review')
    expect(store.getState().run!.review!.score).toBeLessThan(TUTORIAL_PASS_SCORE)
    expect(store.getState().save.tutorialCompleted).toBe(false)
    expect(savedState(data).tutorialCompleted).toBe(false)
    expect(savedState(data).archive[0].kind).toBe('tutorial')

    store.getState().newRun() // TRY AGAIN
    expect(store.getState().screen).toBe('game')
    expect(store.getState().run!.config.kind).toBe('tutorial')
    expect(store.getState().run!.sprint).toBe(1)
    expect(store.getState().tutorial.seen).toEqual([]) // a fresh attempt gets its tips again
  })
})

describe('a returning player', () => {
  it('skips the tutorial entirely and starts at the concept screen', () => {
    const store = createGameStore(returning().storage)
    const s = store.getState()
    expect(s.screen).toBe('concept')
    expect(s.concept.title).toBe('')
    expect(s.save.tutorialCompleted).toBe(true)
    s.setConcept({ title: 'X', idea: 'Y' })
    store.getState().startRun()
    expect(store.getState().run!.config.kind).toBe('full')
  })

  it('treats an old save with played runs and no tutorial flag as returning, with the default theme', () => {
    const { storage } = memoryStorage({
      [SAVE_KEY]: JSON.stringify({ runs: [{ title: 'Legacy Game', score: 64, genre: 'RPG' }] }),
    })
    const store = createGameStore(storage)
    expect(store.getState().screen).toBe('concept')
    expect(store.getState().save.tutorialCompleted).toBe(true)
    expect(store.getState().save.theme).toBe('midnight')
    expect(store.getState().save.archive[0].title).toBe('Legacy Game')
  })

  it('shows past games in the archive after a run', () => {
    const store = createGameStore(returning().storage)
    store.getState().setConcept({ title: 'Iron Pulse', idea: 'A brutal combat game.' })
    store.getState().startRun()
    playOut(store, balanced({ features: ['combat', 'story', 'customization'] }))
    const archive = store.getState().save.archive
    expect(archive).toHaveLength(1)
    expect(archive[0]).toMatchObject({ title: 'Iron Pulse', kind: 'full' })
  })
})

describe('themes', () => {
  it('saves the chosen theme without touching anything else', () => {
    const { storage, data } = returning({ theme: 'sunset' })
    const store = createGameStore(storage)
    expect(store.getState().save.theme).toBe('sunset')
    store.getState().setTheme('terminal')
    expect(store.getState().save.theme).toBe('terminal')
    expect(savedState(data)).toMatchObject({ theme: 'terminal', tutorialCompleted: true })
  })

  it('keeps the theme across a whole new store (a page reload)', () => {
    const { storage } = memoryStorage()
    createGameStore(storage).getState().setTheme('paper')
    expect(createGameStore(storage).getState().save.theme).toBe('paper')
  })

  it('survives storage that is not available', () => {
    const store = createGameStore(null)
    expect(() => store.getState().setTheme('paper')).not.toThrow()
    expect(store.getState().save.theme).toBe('paper')
  })
})

describe('the tutorial script inside the store', () => {
  it('shows each scripted event once, at its fixed sprint', () => {
    const store = createGameStore(memoryStorage().storage)
    store.getState().beginTutorial()
    store.getState().startRun()
    const policy = balanced({ features: [...FOUR] })
    const seenEvents: Array<[number, string]> = []

    for (let guard = 0; guard < 200 && store.getState().screen === 'game'; guard++) {
      const s = store.getState()
      if (s.tutorial.activeEvent) {
        seenEvents.push([s.run!.sprint, s.tutorial.activeEvent])
        store.getState().dismissTutorialEvent()
        continue
      }
      if (s.tutorial.activeTip) {
        store.getState().dismissTutorialTip()
        continue
      }
      const run = s.run!
      if (run.actionsLeft === 0) store.getState().closeSprint()
      else {
        const choice = policy(run)
        if (choice === 'ship') store.getState().ship()
        else store.getState().perform(choice)
      }
    }
    expect(seenEvents).toEqual([
      [2, 'event-morale'],
      [3, 'event-scope'],
      [5, 'event-hype'],
      [6, 'event-deadline'],
    ])
  })

  it('never repeats a dismissed tip', () => {
    const store = createGameStore(memoryStorage().storage)
    store.getState().beginTutorial()
    store.getState().startRun()
    store.getState().dismissTutorialTip()
    expect(store.getState().tutorial.seen).toContain('tip-actions')
    expect(store.getState().tutorial.activeTip).toBeNull()
    store.getState().perform({ type: 'HYPE' })
    expect(store.getState().tutorial.activeTip?.id).not.toBe('tip-actions')
  })
})

describe('full-game behaviour is unchanged', () => {
  function started() {
    const store = createGameStore(returning().storage)
    store.getState().setConcept({ title: '  Iron Pulse ', idea: 'A brutal physics-driven combat game.', genre: 'Racing' })
    store.getState().startRun()
    return store
  }

  it('starts a run from the chosen concept, trimmed', () => {
    const store = started()
    expect(store.getState().screen).toBe('game')
    expect(store.getState().run!.concept).toEqual({
      title: 'Iron Pulse',
      idea: 'A brutal physics-driven combat game.',
      genre: 'Racing',
    })
  })

  it('will not start without a title and an idea', () => {
    const store = createGameStore(returning().storage)
    store.getState().startRun()
    expect(store.getState().screen).toBe('concept')
    store.getState().setConcept({ title: 'Only a title' })
    store.getState().startRun()
    expect(store.getState().screen).toBe('concept')
  })

  it('refuses illegal actions and leaves the run alone', () => {
    const store = started()
    const before = store.getState().run
    expect(store.getState().perform({ type: 'FIX' }).ok).toBe(false)
    expect(store.getState().run).toBe(before)
  })

  it('cannot ship before sprint 4, and is forced at sprint 8', () => {
    const store = started()
    store.getState().ship()
    expect(store.getState().screen).toBe('game')
    playOut(store, balanced({ features: ['combat', 'story', 'customization'] }))
    expect(store.getState().screen).toBe('review')
    expect(store.getState().run!.review!.forced).toBe(true)
    expect(store.getState().run!.review!.shippedSprint).toBe(8)
  })

  it('NEW RUN keeps the concept, uses a new seed, and starts clean', () => {
    const store = started()
    playOut(store, balanced({ features: ['combat', 'story', 'customization'] }))
    const finished = store.getState().run!
    store.getState().newRun()
    const fresh = store.getState().run!
    expect(store.getState().screen).toBe('game')
    expect(fresh.concept).toEqual(finished.concept)
    expect(fresh.seed).not.toBe(finished.seed)
    expect(fresh.sprint).toBe(1)
    expect({ money: fresh.money, morale: fresh.morale, hype: fresh.hype, bugs: fresh.bugs }).toEqual({
      money: 500,
      morale: 70,
      hype: 0,
      bugs: 0,
    })
    expect(fresh.features.every((f) => f.state === 'PLANNED' && f.progress === 0 && f.quality === 0)).toBe(true)
    expect(fresh.history).toEqual([])
    expect(fresh.log).toHaveLength(1)
    expect(store.getState().turningPoint).toBeNull()
  })

  it('does not let the old run change while the new one is played', () => {
    const store = started()
    playOut(store, balanced({ features: ['combat', 'story', 'customization'] }))
    const finished = store.getState().run!
    const snapshot = JSON.stringify(finished)
    store.getState().newRun()
    store.getState().perform({ type: 'HYPE' })
    expect(JSON.stringify(finished)).toBe(snapshot)
  })

  it('can go back and change the concept without losing it', () => {
    const store = started()
    playOut(store, balanced({ features: ['combat', 'story', 'customization'] }))
    store.getState().editConcept()
    expect(store.getState().screen).toBe('concept')
    expect(store.getState().concept.title).toBe('Iron Pulse')
    store.getState().setConcept({ title: 'Iron Pulse 2' })
    store.getState().startRun()
    expect(store.getState().run!.concept.title).toBe('Iron Pulse 2')
    expect(store.getState().run!.sprint).toBe(1)
  })
})
