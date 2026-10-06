import { describe, expect, it } from 'vitest'
import { cancelPromise, describeChanges, legacyVerdict, releaseUpdate, retireGame } from './index'
import type { Concept, RunState } from './index'
import { communityReaction, joinNames, releaseSummary, snapshotOf } from './patchNotes'
import { TEST_CONCEPT } from './testing/bots'
import { FOUR_BUILT, act, built, goLive, polish } from './testing/helpers'

const concept: Concept = { ...TEST_CONCEPT, seedFeatures: ['combat', 'physics'], vision: 'Brawls with weight' }

describe('what changed since the last release', () => {
  it('finds nothing in a game that has not changed', () => {
    const s = goLive({ features: FOUR_BUILT })
    const changes = describeChanges(s)
    expect(changes.changed).toBe(false)
    expect(changes.items).toEqual([])
    expect(releaseSummary(changes)).toBe('minor tweaks')
  })

  it('reports a feature that was added, and says when it was promised', () => {
    let s = goLive({ features: FOUR_BUILT, concept })
    s = { ...s, features: s.features.map((f) => (f.id === 'physics' ? { ...f, state: 'PLAYABLE' as const, quality: 60, progress: 12 } : f)) }
    const changes = describeChanges(s)
    expect(changes.items).toContain('Added Physics (as promised)')
    expect(changes.newFeatures).toBe(1)
    expect(changes.parts).toContain('added Physics')
  })

  it('says "added" without "as promised" for a feature nobody promised', () => {
    let s = goLive({ features: FOUR_BUILT, concept })
    s = { ...s, features: s.features.map((f) => (f.id === 'vehicles' ? { ...f, state: 'PLAYABLE' as const, quality: 55, progress: 12 } : f)) }
    expect(describeChanges(s).items).toContain('Added Vehicles')
  })

  it('reports a feature that reached POLISHED', () => {
    let s = goLive({ features: { ...FOUR_BUILT, combat: built(60) }, concept })
    s = polish(polish(s, 'combat'), 'combat')
    const changes = describeChanges(s)
    expect(changes.items.join(' ')).toMatch(/Polished Combat/)
    expect(changes.parts.join(' ')).toMatch(/polished Combat/)
  })

  it('reports a feature that improved a lot but is not polished yet', () => {
    let s = goLive({ features: { ...FOUR_BUILT, combat: built(30) }, concept })
    s = polish(polish(s, 'combat'), 'combat')
    expect(describeChanges(s).items.join(' ')).toMatch(/Improved Combat/)
  })

  it('reports fixed bugs, naming one of them in a funny way that stays the same for the same run', () => {
    let s = goLive({ features: FOUR_BUILT, bugs: 5, concept })
    s = act(s, { type: 'FIX' })
    const a = describeChanges(s)
    const b = describeChanges(s)
    expect(a.items[0]).toMatch(/^Fixed 3 bugs, including .+/)
    expect(a).toEqual(b)
    expect(a.parts[0]).toMatch(/^fixed .+/)
  })

  it('reports new bugs honestly as known issues', () => {
    const s = { ...goLive({ features: FOUR_BUILT, bugs: 1, concept }) }
    const more = { ...s, bugs: 4 }
    expect(describeChanges(more).items).toContain('Known issues: 3 new bugs, under investigation')
  })

  it('reports a cancelled promise as a roadmap trim', () => {
    const s = cancelPromise(goLive({ features: FOUR_BUILT, concept }), 'physics')
    const changes = describeChanges(s)
    expect(changes.items).toContain('Removed Physics from the roadmap')
    expect(changes.parts).toContain('trimmed the roadmap')
  })

  it('includes notes that events left behind', () => {
    const s = goLive({ features: FOUR_BUILT, concept })
    const withNote = { ...s, live: { ...s.live!, pendingNotes: ['Added the community wall-jump mod as an official feature'] } }
    expect(describeChanges(withNote).items).toContain('Added the community wall-jump mod as an official feature')
  })

  it('still counts a small quality change as something to release', () => {
    let s = goLive({ features: FOUR_BUILT, concept })
    s = { ...s, features: s.features.map((f) => (f.id === 'story' ? { ...f, quality: f.quality + 2 } : f)) }
    const changes = describeChanges(s)
    expect(changes.changed).toBe(true)
    expect(changes.items).toContain('Small quality and balance tweaks')
  })

  it('summarises with the first two things that happened', () => {
    let s = goLive({ features: { ...FOUR_BUILT, combat: built(60) }, bugs: 4, concept })
    s = act(s, { type: 'FIX' })
    s = polish(polish(s, 'combat'), 'combat')
    const summary = releaseSummary(describeChanges(s))
    expect(summary).toMatch(/^polished Combat, fixed /)
  })

  it('takes a snapshot that a release then resets', () => {
    let s = goLive({ features: { ...FOUR_BUILT, combat: built(60) }, bugs: 4, concept })
    s = act(s, { type: 'FIX' })
    const released = releaseUpdate(s)
    expect(released.live!.snapshot).toEqual(snapshotOf(s))
    expect(describeChanges(released).changed).toBe(false)
  })
})

describe('the release notes a player reads', () => {
  it('print a version, a summary, bullet notes and a reaction', () => {
    let s = goLive({ features: { ...FOUR_BUILT, combat: built(60) }, bugs: 4, concept })
    s = act(s, { type: 'FIX' })
    s = polish(polish(s, 'combat'), 'combat')
    const release = releaseUpdate(s).live!.releases[0]
    expect(release.version).toBe('v1.1')
    expect(release.summary).toMatch(/polished Combat/)
    expect(release.notes.length).toBeGreaterThanOrEqual(2)
    expect(release.reaction).toMatch(/\w/)
    expect(release.liveSprint).toBe(1)
  })

  it('count up: v1.1, v1.2, v1.3', () => {
    let s = goLive({ features: { ...FOUR_BUILT, combat: built(30) }, bugs: 9, concept })
    const versions: string[] = []
    for (let i = 0; i < 3; i++) {
      s = { ...s, actionsLeft: 3 }
      s = act(s, { type: 'FIX' })
      s = polish(s, 'combat')
      s = { ...s, features: s.features.map((f) => (f.id === 'story' ? { ...f, quality: Math.min(100, f.quality + 9) } : f)) }
      s = releaseUpdate(s)
      versions.push(s.live!.releases.at(-1)!.version)
    }
    expect(versions).toEqual(['v1.1', 'v1.2', 'v1.3'])
  })
})

describe('community reaction', () => {
  it('goes from thrilled to grumpy as the legacy score moves', () => {
    const lines = [12, 7, 4, 2, 0, -3].map((delta) => communityReaction(70, 70 + delta, 0))
    expect(new Set(lines).size).toBe(6) // a different mood for each size of change
    expect(communityReaction(70, 82, 0)).toMatch(/thrilled|promised|cancelling/i)
    expect(communityReaction(70, 66, 0)).toMatch(/grumpy|better before|not happy/i)
    expect(communityReaction(70, 70, 0)).toMatch(/nobody|zero/i)
  })

  it('has more than one way to say it, picked by a stable number', () => {
    expect(communityReaction(70, 80, 0)).not.toBe(communityReaction(70, 80, 1))
    expect(communityReaction(70, 80, 2)).toBe(communityReaction(70, 80, 0))
  })

  it('joins names the way English does', () => {
    expect(joinNames([])).toBe('')
    expect(joinNames(['A'])).toBe('A')
    expect(joinNames(['A', 'B'])).toBe('A and B')
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C')
  })
})

describe('the final legacy card text', () => {
  const retiredWith = (s: RunState) => {
    const end = retireGame(s)
    return { end, lines: legacyVerdict(end, end.legacy!) }
  }

  it('says so when you retire straight after launch', () => {
    const { lines } = retiredWith({ ...goLive({ features: FOUR_BUILT, concept }), live: null, phase: 'shipped' })
    expect(lines[0]).toMatch(/straight after launch/)
  })

  it('celebrates a COMPLETE game', () => {
    const five = { ...FOUR_BUILT, physics: built(75) }
    const { lines, end } = retiredWith(goLive({ features: five, concept }))
    expect(end.legacy!.complete).toBe(true)
    expect(lines[0]).toMatch(/COMPLETE/)
    expect(lines[0]).toMatch(/every promise kept/)
  })

  it('describes a turnaround with both bands', () => {
    let s = goLive({ features: { combat: built(30), story: built(30), crafting: built(30), customization: built(30) }, bugs: 6, concept })
    s = {
      ...s,
      bugs: 0,
      features: s.features.map((f) => (f.state !== 'PLANNED' ? { ...f, quality: 90, state: 'POLISHED' as const } : f)),
    }
    const { lines, end } = retiredWith(s)
    expect(end.legacy!.score - end.legacy!.launchScore).toBeGreaterThanOrEqual(10)
    expect(lines[0]).toMatch(/turned .* around/)
    expect(lines[0]).toContain(end.legacy!.launchBand)
    expect(lines[0]).toContain(end.legacy!.band)
  })

  it('blames neglect, not the updates, when bugs piled up and the game rotted', () => {
    const s = { ...goLive({ features: FOUR_BUILT, concept }), bugs: 25 }
    const { lines, end } = retiredWith(s)
    expect(end.legacy!.score - end.legacy!.launchScore).toBeLessThan(-2)
    expect(lines[0]).toMatch(/bugs piled up and nobody fixed them/)
  })

  it('admits when the updates made things worse without a pile of bugs', () => {
    const base = goLive({ features: FOUR_BUILT, concept })
    // quality fell (say, a rushed rework) but the build is bug-free
    const s = { ...base, features: base.features.map((f) => (f.state !== 'PLANNED' ? { ...f, quality: 30, state: 'PLAYABLE' as const } : f)) }
    const { lines, end } = retiredWith(s)
    expect(end.legacy!.score - end.legacy!.launchScore).toBeLessThan(-2)
    expect(lines[0]).toMatch(/more harm than good/)
  })

  it('names what was cancelled, and what was left unbuilt', () => {
    const cancelled = retiredWith(cancelPromise(goLive({ features: FOUR_BUILT, concept }), 'physics'))
    expect(cancelled.lines.join(' ')).toMatch(/Cancelled for good: Physics/)
    const open = retiredWith(goLive({ features: FOUR_BUILT, concept }))
    expect(open.lines.join(' ')).toMatch(/Still unbuilt when it ended: Physics/)
  })

  it('says how it ended: chosen, or the money ran out', () => {
    const chosen = retiredWith(goLive({ features: FOUR_BUILT, concept }))
    expect(chosen.lines.join(' ')).toMatch(/You retired it after 0 live sprints and 0 releases/)
    const broke = { ...chosen.end, legacy: { ...chosen.end.legacy!, reason: 'broke' as const } }
    expect(legacyVerdict(broke, broke.legacy!).join(' ')).toMatch(/ran dry .* studio closed/)
  })

  it('ends with the vision the player set out with', () => {
    const { lines } = retiredWith(goLive({ features: FOUR_BUILT, concept }))
    expect(lines.at(-1)).toBe('You set out to make: Brawls with weight.')
  })

  it('is never longer than four lines', () => {
    const s = cancelPromise(goLive({ features: FOUR_BUILT, concept }), 'physics')
    expect(retiredWith(s).lines.length).toBeLessThanOrEqual(4)
  })

  it('has no vision line when the concept has none', () => {
    const { lines } = retiredWith(goLive({ features: FOUR_BUILT }))
    expect(lines.join(' ')).not.toMatch(/set out to make/)
  })
})
