import { describe, expect, it } from 'vitest'
import { FEATURE_DEFS } from '../content/features'
import {
  HYPE_GAIN,
  MAX_HYPE,
  MORALE_DELTA,
  POLISHED_AT,
  REST_GAIN,
  SPRINT_BURN,
  START_RESOURCES,
  TOTAL_SPRINTS,
  applyAction,
  bugDrift,
  buildCost,
  canShip,
  createRun,
  endSprint,
  getScope,
  scopeLevelFor,
  shipGame,
  sprintEndEffects,
} from './index'
import { SCOPE_EFFICIENCY, BUILD_POWER } from './scope'
import { TEST_CONCEPT } from './testing/bots'
import { act, build, deepFreeze, freshRun, idleSprint, polish, spendSlots, withFeature } from './testing/helpers'

const feature = (s: ReturnType<typeof freshRun>, id: string) => s.features.find((f) => f.id === id)!

describe('starting a run', () => {
  it('begins at sprint 1 with 3 slots and the contract resources', () => {
    const s = freshRun(42)
    expect(s.phase).toBe('developing')
    expect(s.sprint).toBe(1)
    expect(s.actionsLeft).toBe(3)
    expect({ money: s.money, morale: s.morale, hype: s.hype, bugs: s.bugs }).toEqual({
      money: 100,
      morale: 70,
      hype: 0,
      bugs: 0,
    })
    expect(START_RESOURCES).toEqual({ money: 100, morale: 70, hype: 0, bugs: 0 })
    expect(s.seed).toBe(42)
    expect(s.review).toBeNull()
    expect(s.history).toEqual([])
  })

  it('has exactly the six features, all PLANNED and unbuilt', () => {
    const s = freshRun()
    expect(s.features.map((f) => f.name)).toEqual([
      'Combat',
      'Story',
      'Crafting',
      'Physics',
      'Vehicles',
      'Character Customization',
    ])
    for (const f of s.features) {
      expect(f.state).toBe('PLANNED')
      expect(f.progress).toBe(0)
      expect(f.quality).toBe(0)
      expect(f.description.length).toBeGreaterThan(0)
      expect(f.complexity).toBeGreaterThanOrEqual(1)
    }
  })

  it('trims the concept text and keeps the genre', () => {
    const s = createRun({ title: '  Iron Pulse  ', idea: '  hello world  ', genre: 'RPG' }, 5)
    expect(s.concept).toEqual({ title: 'Iron Pulse', idea: 'hello world', genre: 'RPG' })
  })

  it('is fully determined by concept + seed', () => {
    expect(createRun(TEST_CONCEPT, 7)).toEqual(createRun(TEST_CONCEPT, 7))
  })
})

describe('action slots', () => {
  it('spends exactly three slots per sprint and records them in order', () => {
    let s = freshRun()
    s = act(s, { type: 'HYPE' })
    expect(s.actionsLeft).toBe(2)
    s = act(s, { type: 'HYPE' })
    s = act(s, { type: 'HYPE' })
    expect(s.actionsLeft).toBe(0)
    const slots = s.history.flatMap((e) => (e.kind === 'action' ? [e.slot] : []))
    expect(slots).toEqual([1, 2, 3])
  })

  it('refuses a fourth action and leaves the state untouched', () => {
    let s = freshRun()
    for (let i = 0; i < 3; i++) s = act(s, { type: 'HYPE' })
    const result = applyAction(s, { type: 'HYPE' })
    expect(result.ok).toBe(false)
    expect(result.state).toBe(s)
    expect(result.reason).toMatch(/slot/i)
  })

  it('does not let the sprint end while slots remain', () => {
    const s = act(freshRun(), { type: 'HYPE' })
    expect(endSprint(s)).toBe(s)
  })

  it('refuses illegal targets', () => {
    const s = freshRun()
    expect(applyAction(s, { type: 'BUILD' }).ok).toBe(false)
    expect(applyAction(s, { type: 'POLISH', featureId: 'combat' }).ok).toBe(false) // not playable yet
    expect(applyAction(s, { type: 'FIX' }).ok).toBe(false) // no bugs
  })
})

describe('BUILD', () => {
  it('advances progress, adds bugs, costs morale and adds scope pressure', () => {
    const s0 = freshRun()
    const s1 = build(s0, 'combat')
    const combat = feature(s1, 'combat')
    expect(combat.state).toBe('PLANNED')
    expect(combat.progress).toBe(BUILD_POWER.LOW)
    expect(s1.bugs).toBeGreaterThan(s0.bugs)
    expect(s1.morale).toBe(s0.morale + MORALE_DELTA.BUILD)
    expect(getScope(s1.features).load).toBeGreaterThan(getScope(s0.features).load)
  })

  it('turns a finished feature into PLAYABLE with a quality value', () => {
    const s = build(freshRun(), 'customization') // complexity 1: one build at low scope
    const f = feature(s, 'customization')
    expect(f.state).toBe('PLAYABLE')
    expect(f.progress).toBe(buildCost(f))
    expect(f.quality).toBeGreaterThan(0)
    expect(f.quality).toBeLessThan(POLISHED_AT)
  })

  it('takes more actions for a more complex feature', () => {
    let s = freshRun()
    let builds = 0
    while (feature(s, 'combat').state === 'PLANNED') {
      s = build(s, 'combat')
      builds++
      if (builds === 3) s = idleSprint(s)
    }
    expect(builds).toBe(Math.ceil(buildCost(feature(s, 'combat')) / BUILD_POWER.LOW))
    expect(builds).toBeGreaterThan(1)
  })

  it('reworks an already-built feature toward POLISHED, fast but buggy', () => {
    let s = build(freshRun(), 'customization')
    const before = feature(s, 'customization').quality
    const bugsBefore = s.bugs
    s = build(s, 'customization')
    const after = feature(s, 'customization')
    expect(after.quality).toBeGreaterThan(before)
    expect(after.state).toBe('POLISHED')
    expect(s.bugs).toBeGreaterThan(bugsBefore)
  })
})

describe('POLISH', () => {
  it('raises quality of a built feature, trims a bug and costs little morale', () => {
    let s = build(freshRun(), 'customization')
    const qBefore = feature(s, 'customization').quality
    const bugsBefore = s.bugs
    const moraleBefore = s.morale
    s = polish(s, 'customization')
    expect(feature(s, 'customization').quality).toBeGreaterThan(qBefore)
    expect(s.bugs).toBe(bugsBefore - 1)
    expect(s.morale).toBe(moraleBefore + MORALE_DELTA.POLISH)
  })

  it('promotes a feature to POLISHED once quality reaches the threshold', () => {
    let s = build(freshRun(), 'customization')
    s = polish(s, 'customization')
    s = polish(s, 'customization')
    expect(feature(s, 'customization').quality).toBeGreaterThanOrEqual(POLISHED_AT)
    expect(feature(s, 'customization').state).toBe('POLISHED')
  })

  it('never exceeds quality 100 and refuses to polish a flawless feature', () => {
    let s = build(freshRun(), 'customization')
    s = withFeature(s, 'customization', { quality: 99, state: 'POLISHED' })
    s = polish(s, 'customization')
    expect(feature(s, 'customization').quality).toBe(100)
    expect(applyAction(s, { type: 'POLISH', featureId: 'customization' }).ok).toBe(false)
  })

  it('does not advance development: a PLANNED feature cannot be polished', () => {
    const result = applyAction(freshRun(), { type: 'POLISH', featureId: 'story' })
    expect(result.ok).toBe(false)
  })
})

describe('FIX', () => {
  it('removes bugs without advancing any feature', () => {
    let s = build(freshRun(), 'combat')
    s = build(s, 'combat')
    const bugsBefore = s.bugs
    const featuresBefore = s.features
    s = act(s, { type: 'FIX' })
    expect(s.bugs).toBeLessThan(bugsBefore)
    expect(s.features).toEqual(featuresBefore)
  })

  it('never takes bugs below zero', () => {
    let s = { ...freshRun(), bugs: 1 }
    s = act(s, { type: 'FIX' })
    expect(s.bugs).toBe(0)
  })

  it('is weaker when scope is critical', () => {
    const low = act({ ...freshRun(), bugs: 20 }, { type: 'FIX' })
    let big = { ...freshRun(), bugs: 20 }
    for (const id of ['combat', 'physics', 'vehicles', 'crafting'] as const) {
      big = withFeature(big, id, { state: 'PLAYABLE', progress: buildCost(feature(big, id)), quality: 50 })
    }
    expect(getScope(big.features).level).toBe('CRITICAL')
    const crit = act(big, { type: 'FIX' })
    expect(20 - crit.bugs).toBeLessThan(20 - low.bugs)
  })
})

describe('HYPE', () => {
  it('raises hype but does not improve the game', () => {
    const s0 = freshRun()
    const s1 = act(s0, { type: 'HYPE' })
    expect(s1.hype).toBe(HYPE_GAIN)
    expect(s1.features).toEqual(s0.features)
    expect(s1.bugs).toBe(s0.bugs)
    expect(s1.morale).toBe(s0.morale)
  })

  it('is capped at the maximum and then refused', () => {
    let s = { ...freshRun(), hype: MAX_HYPE - 5 }
    s = act(s, { type: 'HYPE' })
    expect(s.hype).toBe(MAX_HYPE)
    expect(applyAction(s, { type: 'HYPE' }).ok).toBe(false)
  })
})

describe('REST', () => {
  it('recovers morale and builds nothing', () => {
    const s0 = { ...freshRun(), morale: 40 }
    const s1 = act(s0, { type: 'REST' })
    expect(s1.morale).toBe(40 + REST_GAIN)
    expect(s1.features).toEqual(s0.features)
  })

  it('caps morale at 100 and is refused when the team is already full', () => {
    let s = { ...freshRun(), morale: 95 }
    s = act(s, { type: 'REST' })
    expect(s.morale).toBe(100)
    expect(applyAction(s, { type: 'REST' }).ok).toBe(false)
  })
})

describe('morale and bugs interact', () => {
  it('a burned-out team builds buggier code than a focused one', () => {
    const focused = build({ ...freshRun(), morale: 80 }, 'combat')
    const burned = build({ ...freshRun(), morale: 5 }, 'combat')
    expect(burned.bugs).toBeGreaterThan(focused.bugs)
  })

  it('a bigger game builds buggier code than a small one', () => {
    let big = freshRun()
    for (const id of ['combat', 'physics', 'vehicles'] as const) {
      big = withFeature(big, id, { state: 'PLAYABLE', progress: 12, quality: 50 })
    }
    expect(getScope(big.features).level).toBe('HIGH')
    const small = build(freshRun(), 'story')
    expect(build(big, 'story').bugs).toBeGreaterThan(small.bugs)
  })
})

describe('scope', () => {
  it('maps pressure to LOW / MEDIUM / HIGH / CRITICAL', () => {
    expect(scopeLevelFor(0)).toBe('LOW')
    expect(scopeLevelFor(3.9)).toBe('LOW')
    expect(scopeLevelFor(4)).toBe('MEDIUM')
    expect(scopeLevelFor(7.9)).toBe('MEDIUM')
    expect(scopeLevelFor(8)).toBe('HIGH')
    expect(scopeLevelFor(10.9)).toBe('HIGH')
    expect(scopeLevelFor(11)).toBe('CRITICAL')
  })

  it('starts LOW and grows as features become playable', () => {
    let s = freshRun()
    expect(getScope(s.features)).toEqual({ load: 0, level: 'LOW' })
    s = withFeature(s, 'combat', { state: 'PLAYABLE', progress: 12, quality: 50 })
    expect(getScope(s.features).load).toBe(3)
    s = withFeature(s, 'physics', { state: 'PLAYABLE', progress: 12, quality: 50 })
    expect(getScope(s.features).level).toBe('MEDIUM')
    s = withFeature(s, 'vehicles', { state: 'POLISHED', progress: 12, quality: 80 })
    expect(getScope(s.features).level).toBe('HIGH')
    s = withFeature(s, 'story', { state: 'PLAYABLE', progress: 8, quality: 50 })
    s = withFeature(s, 'crafting', { state: 'PLAYABLE', progress: 8, quality: 50 })
    expect(getScope(s.features).level).toBe('CRITICAL')
  })

  it('counts unfinished work too, so every BUILD pushes scope up', () => {
    const s = withFeature(freshRun(), 'combat', { progress: 8 })
    expect(getScope(s.features).load).toBe(2)
  })

  it('makes development steadily less efficient as scope grows', () => {
    const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
    for (let i = 1; i < levels.length; i++) {
      expect(SCOPE_EFFICIENCY[levels[i]]).toBeLessThan(SCOPE_EFFICIENCY[levels[i - 1]])
      expect(BUILD_POWER[levels[i]]).toBeLessThan(BUILD_POWER[levels[i - 1]])
    }
  })

  it('lowers the quality of a freshly built feature when scope is already high', () => {
    const lean = build(freshRun(), 'customization')
    let heavy = freshRun()
    for (const id of ['combat', 'physics', 'vehicles'] as const) {
      heavy = withFeature(heavy, id, { state: 'PLAYABLE', progress: 12, quality: 50 })
    }
    const heavyBuilt = build(heavy, 'customization')
    // the heavy game needs two builds at lower power; finish it
    const finished = feature(heavyBuilt, 'customization').state === 'PLANNED' ? build(heavyBuilt, 'customization') : heavyBuilt
    expect(feature(finished, 'customization').quality).toBeLessThan(feature(lean, 'customization').quality)
  })
})

describe('sprint advancement', () => {
  it('burns money, drifts bugs, refills slots and moves to the next sprint', () => {
    let s = freshRun()
    s = build(s, 'customization')
    s = act(s, { type: 'HYPE' })
    s = act(s, { type: 'HYPE' })
    const money = s.money
    const next = endSprint(s)
    expect(next.sprint).toBe(2)
    expect(next.actionsLeft).toBe(3)
    expect(next.money).toBe(money - SPRINT_BURN)
    expect(next.phase).toBe('developing')
    expect(next.history.at(-1)).toEqual({ kind: 'endSprint', sprint: 1 })
  })

  it('previews exactly what endSprint applies', () => {
    let s = freshRun()
    for (const id of ['combat', 'physics', 'vehicles'] as const) {
      s = withFeature(s, id, { state: 'PLAYABLE', progress: 12, quality: 50 })
    }
    s = { ...s, actionsLeft: 0 }
    const fx = sprintEndEffects(s)
    const next = endSprint(s)
    expect(next.money).toBe(s.money + fx.money)
    expect(next.bugs).toBe(s.bugs + fx.bugs)
    expect(fx.bugs).toBe(bugDrift('HIGH', 'FOCUSED'))
  })

  it('lets bugs creep in on their own only when the game is big', () => {
    expect(bugDrift('LOW', 'FOCUSED')).toBe(0)
    expect(bugDrift('CRITICAL', 'FOCUSED')).toBeGreaterThan(bugDrift('MEDIUM', 'FOCUSED'))
    expect(bugDrift('LOW', 'BURNED OUT')).toBeGreaterThan(bugDrift('LOW', 'FOCUSED'))
  })

  it('keeps running when the money is gone, but the team suffers', () => {
    let s = { ...freshRun(), money: 10, morale: 60 }
    s = { ...s, actionsLeft: 0 }
    const next = endSprint(s)
    expect(next.money).toBe(10 - SPRINT_BURN)
    expect(next.money).toBeLessThan(0)
    expect(next.phase).toBe('developing')
    expect(next.sprint).toBe(2)
    expect(next.morale).toBeLessThan(60)
  })
})

describe('shipping', () => {
  it('cannot ship before sprint 4, and can from sprint 4', () => {
    let s = freshRun()
    for (let sprint = 1; sprint <= 3; sprint++) {
      expect(s.sprint).toBe(sprint)
      expect(canShip(s)).toBe(false)
      expect(shipGame(s)).toBe(s)
      s = idleSprint(s)
    }
    expect(s.sprint).toBe(4)
    expect(canShip(s)).toBe(true)
  })

  it('can ship early from sprint 4, even mid-sprint', () => {
    let s = freshRun()
    for (let i = 0; i < 3; i++) s = idleSprint(s)
    s = act(s, { type: 'HYPE' })
    const shipped = shipGame(s)
    expect(shipped.phase).toBe('shipped')
    expect(shipped.review).not.toBeNull()
    expect(shipped.review!.shippedSprint).toBe(4)
    expect(shipped.review!.forced).toBe(false)
  })

  it('forces shipping when sprint 8 is over', () => {
    let s = freshRun()
    for (let i = 0; i < TOTAL_SPRINTS - 1; i++) s = idleSprint(s)
    expect(s.sprint).toBe(TOTAL_SPRINTS)
    expect(s.phase).toBe('developing')
    s = spendSlots(s)
    expect(s.actionsLeft).toBe(0)
    const shipped = endSprint(s)
    expect(shipped.phase).toBe('shipped')
    expect(shipped.sprint).toBe(TOTAL_SPRINTS)
    expect(shipped.review!.forced).toBe(true)
    expect(shipped.review!.shippedSprint).toBe(TOTAL_SPRINTS)
  })

  it('never runs past sprint 8', () => {
    let s = freshRun()
    for (let i = 0; i < 30 && s.phase === 'developing'; i++) s = idleSprint(s)
    expect(s.phase).toBe('shipped')
    expect(s.sprint).toBeLessThanOrEqual(TOTAL_SPRINTS)
  })

  it('accepts nothing once shipped', () => {
    let s = freshRun()
    for (let i = 0; i < TOTAL_SPRINTS; i++) s = idleSprint(s)
    expect(s.phase).toBe('shipped')
    expect(applyAction(s, { type: 'HYPE' }).ok).toBe(false)
    expect(endSprint(s)).toBe(s)
    expect(shipGame(s)).toBe(s)
  })
})

describe('purity and isolation between runs', () => {
  it('never mutates the state it is given', () => {
    const frozen = deepFreeze(freshRun(3))
    let s = frozen
    expect(() => {
      s = deepFreeze(build(s, 'customization'))
      s = deepFreeze(polish(s, 'customization'))
      s = deepFreeze(act({ ...s, bugs: 3, actionsLeft: 3 }, { type: 'FIX' }))
      s = deepFreeze(act(s, { type: 'HYPE' }))
      s = deepFreeze(act({ ...s, actionsLeft: 3, morale: 40 }, { type: 'REST' }))
      s = deepFreeze(endSprint({ ...s, actionsLeft: 0 }))
    }).not.toThrow()
  })

  it('shares no state between two runs', () => {
    let a = freshRun(1)
    a = build(a, 'combat')
    a = act(a, { type: 'HYPE' })
    a = idleSprint(act(a, { type: 'HYPE' }))
    const b = freshRun(2)
    expect(b.sprint).toBe(1)
    expect(b.hype).toBe(0)
    expect(b.history).toEqual([])
    expect(b.log).toHaveLength(1)
    expect(b.features.every((f) => f.state === 'PLANNED' && f.progress === 0)).toBe(true)
    expect(b.features).not.toBe(a.features)
    for (const f of b.features) expect(a.features.includes(f)).toBe(false)
  })

  it('leaves the static content definitions untouched', () => {
    const snapshot = JSON.stringify(FEATURE_DEFS)
    let s = freshRun()
    s = build(s, 'customization')
    s = polish(s, 'customization')
    expect(JSON.stringify(FEATURE_DEFS)).toBe(snapshot)
  })

  it('is deterministic: the same inputs always give the same run', () => {
    const play = () => {
      let s = freshRun(99)
      s = build(s, 'combat')
      s = build(s, 'combat')
      s = act(s, { type: 'HYPE' })
      return idleSprint(s)
    }
    expect(play()).toEqual(play())
  })
})
