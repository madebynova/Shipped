import { describe, expect, it } from 'vitest'
import { GENRES } from '../content/genres'
import { FULL_RUN, TUTORIAL_PASS_SCORE, TUTORIAL_RUN, createRun, endSprint } from '../engine'
import type { RunState } from '../engine'
import {
  EMPTY_PROGRESS,
  TUTORIAL_CONCEPT,
  TUTORIAL_EVENTS,
  TUTORIAL_TIPS,
  advanceTutorial,
  dismissEvent,
  dismissTip,
  explainRun,
  tutorialPassed,
} from './script'
import { balanced, greedyBuilder, hypeSpammer, playRun, TEST_CONCEPT } from '../engine/testing/bots'
import { act, deepFreeze, spendSlots } from '../engine/testing/helpers'

const FOUR: Parameters<typeof balanced>[0] = { features: ['combat', 'story', 'crafting', 'customization'] }
const tutorialStart = () => createRun(TEST_CONCEPT, 1, TUTORIAL_RUN)

/** Advance a tutorial run to the start of a given sprint, idling through earlier ones. */
function atSprint(sprint: number): RunState {
  let s = tutorialStart()
  while (s.sprint < sprint) s = endSprint(spendSlots(s))
  return s
}

describe('the starter concept', () => {
  it('is a valid, charming concept the player can rename', () => {
    expect(TUTORIAL_CONCEPT.title.trim().length).toBeGreaterThan(0)
    expect(TUTORIAL_CONCEPT.title.length).toBeLessThanOrEqual(32)
    expect(TUTORIAL_CONCEPT.idea.length).toBeLessThanOrEqual(140)
    expect(GENRES.map((g) => g.id)).toContain(TUTORIAL_CONCEPT.genre)
  })
})

describe('scripted events', () => {
  it('has 3-4 events at fixed, distinct sprints inside the tutorial', () => {
    expect(TUTORIAL_EVENTS.length).toBeGreaterThanOrEqual(3)
    expect(TUTORIAL_EVENTS.length).toBeLessThanOrEqual(4)
    const sprints = TUTORIAL_EVENTS.map((e) => e.sprint)
    expect(new Set(sprints).size).toBe(sprints.length)
    for (const sprint of sprints) {
      expect(sprint).toBeGreaterThan(1)
      expect(sprint).toBeLessThanOrEqual(TUTORIAL_RUN.totalSprints)
    }
  })

  it('every event says what is going on AND why it matters, with real numbers', () => {
    for (const event of TUTORIAL_EVENTS) {
      const run = atSprint(event.sprint)
      const body = event.body(run).join(' ')
      const why = event.why(run)
      expect(body.length).toBeGreaterThan(40)
      expect(why.length).toBeGreaterThan(20)
      for (const text of [body, why, event.title]) expect(text).not.toMatch(/undefined|NaN|\[object/)
    }
    const morale = TUTORIAL_EVENTS.find((e) => e.id === 'event-morale')!
    const run = atSprint(2)
    expect(morale.body(run).join(' ')).toContain(String(run.morale))
  })

  it('appears at the start of its sprint and never before', () => {
    for (const event of TUTORIAL_EVENTS) {
      const before = advanceTutorial(atSprint(event.sprint - 1), EMPTY_PROGRESS)
      expect(before.activeEvent).not.toBe(event.id)
      const at = advanceTutorial(atSprint(event.sprint), EMPTY_PROGRESS)
      expect(at.activeEvent).toBe(event.id)
    }
  })

  it('does not come back once dismissed', () => {
    const run = atSprint(2)
    let p = advanceTutorial(run, EMPTY_PROGRESS)
    expect(p.activeEvent).toBe('event-morale')
    p = advanceTutorial(run, dismissEvent(p))
    expect(p.activeEvent).toBeNull()
    expect(p.seen).toContain('event-morale')
    for (let i = 0; i < 3; i++) expect(advanceTutorial(run, p).activeEvent).not.toBe('event-morale')
  })

  it('takes priority over a tip', () => {
    const run = act(atSprint(2), { type: 'BUILD', featureId: 'customization' }) // would trigger tip-playable
    const p = advanceTutorial(run, EMPTY_PROGRESS)
    expect(p.activeEvent).toBe('event-morale')
    expect(p.activeTip).toBeNull()
  })
})

describe('team tips', () => {
  it('shows the first tip before the first action, and it goes away once the player acts', () => {
    const start = tutorialStart()
    let p = advanceTutorial(start, EMPTY_PROGRESS)
    expect(p.activeTip?.id).toBe('tip-actions')
    p = advanceTutorial(act(start, { type: 'HYPE' }), p)
    expect(p.activeTip?.id).not.toBe('tip-actions')
    expect(p.seen).toContain('tip-actions')
  })

  it('explains BUILD, FIX and POLISH in the first tip', () => {
    const text = TUTORIAL_TIPS.find((t) => t.id === 'tip-actions')!.text(tutorialStart())
    for (const word of ['BUILD', 'FIX', 'POLISH']) expect(text).toContain(word)
  })

  it('fires when the first feature becomes playable', () => {
    const run = act(tutorialStart(), { type: 'BUILD', featureId: 'customization' })
    let p = advanceTutorial(tutorialStart(), EMPTY_PROGRESS)
    p = dismissTip(p)
    p = advanceTutorial(run, p)
    expect(p.activeTip?.id).toBe('tip-playable')
  })

  it('fires when bugs first spike', () => {
    const run = { ...atSprint(1), bugs: 5 }
    const p = advanceTutorial(run, { ...EMPTY_PROGRESS, seen: ['tip-actions', 'tip-playable'] })
    expect(p.activeTip?.id).toBe('tip-bugs')
    expect(TUTORIAL_TIPS.find((t) => t.id === 'tip-bugs')!.text(run)).toContain('5')
  })

  it('fires before the first ship prompt, when the ship window opens', () => {
    const run = atSprint(4)
    const p = advanceTutorial(run, { ...EMPTY_PROGRESS, seen: ['event-morale', 'event-scope', 'tip-actions', 'tip-playable', 'tip-bugs'] })
    expect(p.activeTip?.id).toBe('tip-ship')
    expect(TUTORIAL_TIPS.find((t) => t.id === 'tip-ship')!.text(run)).toContain(String(TUTORIAL_PASS_SCORE))
  })

  it('never shows the same tip twice, across a whole tutorial', () => {
    const shownTips: string[] = []
    let run = tutorialStart()
    let p = EMPTY_PROGRESS
    const policy = balanced(FOUR)
    for (let guard = 0; guard < 100 && run.phase === 'developing'; guard++) {
      p = advanceTutorial(run, p)
      if (p.activeEvent) p = advanceTutorial(run, dismissEvent(p))
      if (p.activeTip) {
        shownTips.push(p.activeTip.id)
        p = advanceTutorial(run, dismissTip(p))
      }
      if (run.actionsLeft === 0) {
        run = endSprint(run)
        continue
      }
      const choice = policy(run)
      if (choice === 'ship') break
      run = act(run, choice)
    }
    expect(new Set(shownTips).size).toBe(shownTips.length)
    expect(shownTips.length).toBeGreaterThanOrEqual(2)
  })

  it('a tip lasts only for the sprint it appeared in', () => {
    const start = atSprint(1)
    let p = advanceTutorial(start, { ...EMPTY_PROGRESS, seen: ['tip-actions', 'tip-playable'] })
    p = advanceTutorial({ ...start, bugs: 6 }, p)
    expect(p.activeTip?.id).toBe('tip-bugs')
    const next = endSprint(spendSlots({ ...start, bugs: 6 }))
    p = advanceTutorial(next, p)
    expect(p.activeTip?.id).not.toBe('tip-bugs')
    expect(p.seen).toContain('tip-bugs')
  })
})

describe('only the tutorial is guided', () => {
  it('shows nothing in the full game, ever', () => {
    let run = createRun(TEST_CONCEPT, 1, FULL_RUN)
    for (let sprint = 1; sprint <= 7; sprint++) {
      run = { ...run, bugs: 12 }
      expect(advanceTutorial(run, EMPTY_PROGRESS)).toEqual(EMPTY_PROGRESS)
      run = endSprint(spendSlots(run))
    }
  })

  it('teaching never changes the game: it only reads the run', () => {
    const run = deepFreeze(atSprint(3))
    expect(() => advanceTutorial(run, EMPTY_PROGRESS)).not.toThrow()
    for (const event of TUTORIAL_EVENTS) expect(() => event.body(run)).not.toThrow()
    for (const tip of TUTORIAL_TIPS) expect(() => tip.text(run)).not.toThrow()
  })
})

describe('WHAT JUST HAPPENED', () => {
  const sensible = playRun(balanced(FOUR), TEST_CONCEPT, 1, TUTORIAL_RUN)

  it('is empty until the run has shipped', () => {
    expect(explainRun(tutorialStart())).toEqual([])
  })

  it('always gives 3-4 plain-language bullets built from the real run', () => {
    for (const run of [
      sensible,
      playRun(hypeSpammer, TEST_CONCEPT, 1, TUTORIAL_RUN),
      playRun(greedyBuilder(['customization', 'story', 'crafting', 'combat']), TEST_CONCEPT, 1, TUTORIAL_RUN),
    ]) {
      const bullets = explainRun(run)
      expect(bullets.length).toBeGreaterThanOrEqual(3)
      expect(bullets.length).toBeLessThanOrEqual(4)
      for (const b of bullets) {
        expect(b.length).toBeGreaterThan(30)
        expect(b).not.toMatch(/undefined|NaN|\[object/)
      }
    }
  })

  it('mentions the run\'s actual numbers', () => {
    const text = explainRun(sensible).join(' ')
    expect(text).toContain(String(sensible.review!.content))
    expect(text).toContain(String(sensible.review!.polish))
  })

  it('puts a price on the bugs that shipped', () => {
    const buggy = playRun(greedyBuilder(['customization', 'story', 'crafting', 'combat']), TEST_CONCEPT, 1, TUTORIAL_RUN)
    expect(buggy.bugs).toBeGreaterThan(5)
    const text = explainRun(buggy).join(' ')
    expect(text).toContain(`${buggy.bugs} bugs`)
    expect(text).toMatch(/cost about \d+ points/)
  })

  it('praises a bug-free ship', () => {
    const clean = { ...sensible, bugs: 0 }
    expect(explainRun(clean).join(' ')).toContain('zero bugs')
  })

  it('tells a player who built nothing to BUILD', () => {
    const nothing = playRun(hypeSpammer, TEST_CONCEPT, 1, TUTORIAL_RUN)
    expect(nothing.features.every((f) => f.state === 'PLANNED')).toBe(false) // the bot falls back to building
    const empty = { ...nothing, features: nothing.features.map((f) => ({ ...f, state: 'PLANNED' as const, progress: 0, quality: 0 })) }
    expect(explainRun(empty).join(' ')).toContain('BUILD')
  })

  it('explains hype in both directions', () => {
    const hyped = { ...sensible, hype: 60, review: { ...sensible.review!, hypeModifier: 6, hypeBar: 70 } }
    expect(explainRun(hyped).join(' ')).toContain('+6')
    const burned = { ...sensible, hype: 60, review: { ...sensible.review!, hypeModifier: -9, hypeBar: 70 } }
    expect(explainRun(burned).join(' ')).toContain('costing 9')
  })

  it('is deterministic', () => {
    expect(explainRun(sensible)).toEqual(explainRun(sensible))
  })
})

describe('passing', () => {
  it('requires the pass score exactly', () => {
    const base = playRun(balanced(FOUR), TEST_CONCEPT, 1, TUTORIAL_RUN)
    const at = (score: number) => ({ ...base, review: { ...base.review!, score } })
    expect(tutorialPassed(at(TUTORIAL_PASS_SCORE))).toBe(true)
    expect(tutorialPassed(at(TUTORIAL_PASS_SCORE - 1))).toBe(false)
    expect(tutorialPassed({ ...base, review: null })).toBe(false)
  })
})
