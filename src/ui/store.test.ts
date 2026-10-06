import { beforeEach, describe, expect, it } from 'vitest'
import type { Action } from '../engine'
import { useGameStore } from './store'

const store = () => useGameStore.getState()

const IDLE: Action[] = [
  { type: 'REST' },
  { type: 'HYPE' },
  { type: 'FIX' },
  { type: 'BUILD', featureId: 'story' },
  { type: 'BUILD', featureId: 'vehicles' },
  { type: 'BUILD', featureId: 'combat' },
]

/** Spend whatever slots remain using the first legal move each time. */
function spendSlots() {
  while (store().run && store().run!.actionsLeft > 0 && store().run!.phase === 'developing') {
    const move = IDLE.find((a) => store().perform(a).ok)
    if (!move) throw new Error('no legal move')
  }
}

function startGame(title = '  Iron Pulse ') {
  store().setConcept({ title, idea: 'A brutal physics-driven combat game.', genre: 'Racing' })
  store().startRun()
}

beforeEach(() => {
  useGameStore.setState({
    screen: 'concept',
    concept: { title: '', idea: '', genre: 'Action' },
    run: null,
    turningPoint: null,
  })
})

describe('concept screen', () => {
  it('starts on the concept screen with no run', () => {
    expect(store().screen).toBe('concept')
    expect(store().run).toBeNull()
  })

  it('will not start without a title and an idea', () => {
    store().startRun()
    expect(store().screen).toBe('concept')
    store().setConcept({ title: 'Only a title' })
    store().startRun()
    expect(store().screen).toBe('concept')
    store().setConcept({ title: '   ', idea: 'Only an idea' })
    store().startRun()
    expect(store().screen).toBe('concept')
  })

  it('starts a run from the chosen title, idea and genre', () => {
    startGame()
    expect(store().screen).toBe('game')
    const run = store().run!
    expect(run.sprint).toBe(1)
    expect(run.concept).toEqual({
      title: 'Iron Pulse',
      idea: 'A brutal physics-driven combat game.',
      genre: 'Racing',
    })
  })
})

describe('playing', () => {
  it('applies legal actions and ignores illegal ones', () => {
    startGame()
    expect(store().perform({ type: 'HYPE' }).ok).toBe(true)
    expect(store().run!.hype).toBeGreaterThan(0)
    const before = store().run
    const result = store().perform({ type: 'FIX' }) // no bugs yet
    expect(result.ok).toBe(false)
    expect(store().run).toBe(before)
  })

  it('moves to the next sprint and refills the slots', () => {
    startGame()
    spendSlots()
    expect(store().run!.actionsLeft).toBe(0)
    store().closeSprint()
    expect(store().run!.sprint).toBe(2)
    expect(store().run!.actionsLeft).toBe(3)
    expect(store().screen).toBe('game')
  })

  it('refuses to ship before sprint 4', () => {
    startGame()
    store().ship()
    expect(store().screen).toBe('game')
    expect(store().run!.phase).toBe('developing')
  })

  it('goes to the review when the player ships early', () => {
    startGame()
    for (let i = 0; i < 3; i++) {
      spendSlots()
      store().closeSprint()
    }
    expect(store().run!.sprint).toBe(4)
    store().ship()
    expect(store().screen).toBe('review')
    expect(store().run!.review).not.toBeNull()
    expect(store().run!.review!.forced).toBe(false)
    expect(store().turningPoint).not.toBeNull()
  })

  it('goes to the review by force when sprint 8 ends', () => {
    startGame()
    for (let i = 0; i < 8; i++) {
      spendSlots()
      store().closeSprint()
    }
    expect(store().screen).toBe('review')
    expect(store().run!.review!.forced).toBe(true)
    expect(store().run!.review!.shippedSprint).toBe(8)
  })
})

describe('starting again', () => {
  function playToReview() {
    startGame()
    for (let i = 0; i < 8; i++) {
      spendSlots()
      store().closeSprint()
    }
  }

  it('NEW RUN keeps the concept, uses a new seed and starts at sprint 1 with a clean slate', () => {
    playToReview()
    const finished = store().run!
    expect(store().screen).toBe('review')

    store().newRun()
    const fresh = store().run!
    expect(store().screen).toBe('game')
    expect(fresh.concept).toEqual(finished.concept)
    expect(fresh.seed).not.toBe(finished.seed)
    expect(fresh.sprint).toBe(1)
    expect(fresh.phase).toBe('developing')
    expect({ money: fresh.money, morale: fresh.morale, hype: fresh.hype, bugs: fresh.bugs }).toEqual({
      money: 500,
      morale: 70,
      hype: 0,
      bugs: 0,
    })
    expect(fresh.features.every((f) => f.state === 'PLANNED' && f.progress === 0 && f.quality === 0)).toBe(true)
    expect(fresh.history).toEqual([])
    expect(fresh.log).toHaveLength(1)
    expect(fresh.review).toBeNull()
    expect(store().turningPoint).toBeNull()
  })

  it('does not let the old run be changed by playing the new one', () => {
    playToReview()
    const finished = store().run!
    const snapshot = JSON.stringify(finished)
    store().newRun()
    store().perform({ type: 'HYPE' })
    store().perform({ type: 'BUILD', featureId: 'combat' })
    expect(JSON.stringify(finished)).toBe(snapshot)
  })

  it('can go back and change the concept without losing it', () => {
    playToReview()
    store().editConcept()
    expect(store().screen).toBe('concept')
    expect(store().run).toBeNull()
    expect(store().concept.title).toBe('Iron Pulse')
    store().setConcept({ title: 'Iron Pulse 2' })
    store().startRun()
    expect(store().screen).toBe('game')
    expect(store().run!.concept.title).toBe('Iron Pulse 2')
    expect(store().run!.sprint).toBe(1)
  })

  it('falls back to the concept screen if there is no valid concept to repeat', () => {
    store().newRun()
    expect(store().screen).toBe('concept')
  })
})
