import { describe, expect, it } from 'vitest'
import { TUTORIAL_RUN, originalityScore } from '../engine'
import { CONCEPTS, MAX_IDEA, MAX_TITLE, beginnerConcepts, conceptFromTemplate, findConcept, rollConcept } from './concepts'
import { FEATURE_DEFS } from './features'
import { GENRES } from './genres'

const featureIds = FEATURE_DEFS.map((f) => f.id)
const genreIds = GENRES.map((g) => g.id)

describe('the concept gallery', () => {
  it('has at least twelve concepts', () => {
    expect(CONCEPTS.length).toBeGreaterThanOrEqual(12)
  })

  it('gives every concept its own id and its own name', () => {
    expect(new Set(CONCEPTS.map((c) => c.id)).size).toBe(CONCEPTS.length)
    expect(new Set(CONCEPTS.map((c) => c.title.toLowerCase())).size).toBe(CONCEPTS.length)
    for (const c of CONCEPTS) expect(c.id, c.title).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('has names that fit the title box', () => {
    for (const c of CONCEPTS) {
      expect(c.title.trim(), c.id).toBe(c.title)
      expect(c.title.length, c.id).toBeGreaterThanOrEqual(3)
      expect(c.title.length, c.id).toBeLessThanOrEqual(MAX_TITLE)
    }
  })

  it('has one-line pitches that fit the idea box', () => {
    for (const c of CONCEPTS) {
      expect(c.pitch.trim(), c.id).toBe(c.pitch)
      expect(c.pitch.length, c.id).toBeGreaterThanOrEqual(40)
      expect(c.pitch.length, c.id).toBeLessThanOrEqual(MAX_IDEA)
      expect(c.pitch, c.id).not.toMatch(/[\n\r]/)
      expect(c.pitch, c.id).toMatch(/[.!?]$/)
      expect(c.pitch, c.id).not.toMatch(/ {2}/)
    }
  })

  it('uses plain characters the bundled fonts can draw', () => {
    for (const c of CONCEPTS) {
      expect(c.title + c.pitch + c.vision, c.id).toMatch(/^[\x20-\x7E]+$/)
    }
  })

  it('gives every concept a genre, and covers all six genres', () => {
    for (const c of CONCEPTS) expect(genreIds, c.id).toContain(c.genre)
    expect(new Set(CONCEPTS.map((c) => c.genre))).toEqual(new Set(genreIds))
  })

  it('gives every concept two or three real, different seed features', () => {
    for (const c of CONCEPTS) {
      expect(c.seedFeatures.length, c.id).toBeGreaterThanOrEqual(2)
      expect(c.seedFeatures.length, c.id).toBeLessThanOrEqual(3)
      expect(new Set(c.seedFeatures).size, c.id).toBe(c.seedFeatures.length)
      for (const f of c.seedFeatures) expect(featureIds, `${c.id}/${f}`).toContain(f)
    }
  })

  it('gives every concept a short vision marker', () => {
    for (const c of CONCEPTS) {
      expect(c.vision.length, c.id).toBeGreaterThanOrEqual(8)
      expect(c.vision.length, c.id).toBeLessThanOrEqual(40)
    }
  })

  it('has strong, specific pitches (they score well for ORIGINALITY)', () => {
    for (const c of CONCEPTS) {
      const score = originalityScore(conceptFromTemplate(c))
      // The old one-line example is allowed to be plainer; every other pitch is rich.
      expect(score, `${c.id} originality ${score}`).toBeGreaterThanOrEqual(c.id === 'iron-pulse' ? 55 : 68)
    }
  })

  it('includes the four ideas from the brief: fishing horror, courier roguelike, heist tactics, idol ranching', () => {
    const text = CONCEPTS.map((c) => `${c.title} ${c.pitch}`.toLowerCase()).join(' ')
    expect(text).toMatch(/fish/)
    expect(text).toMatch(/deliver|courier|parcel/)
    expect(text).toMatch(/heist/)
    expect(text).toMatch(/idol/)
  })

  it('mixes the sane with the strange: some are cozy, some are cursed', () => {
    const moods = CONCEPTS.map((c) => c.vision.toLowerCase()).join(' | ')
    expect(moods).toMatch(/cozy|warm|calm/)
    expect(moods).toMatch(/dread|doomed|dying|cursed|ghost/)
  })
})

describe('the beginner concepts for MY FIRST GAME', () => {
  it('are exactly three', () => {
    expect(beginnerConcepts()).toHaveLength(3)
  })

  it('only lean on the four cards the tutorial run has', () => {
    const cards = TUTORIAL_RUN.featureIds!
    for (const c of beginnerConcepts()) {
      for (const f of c.seedFeatures) expect(cards, `${c.id}/${f}`).toContain(f)
    }
  })

  it('are different genres, so there is a real choice', () => {
    expect(new Set(beginnerConcepts().map((c) => c.genre)).size).toBe(3)
  })

  it('start with the Lantern Hollow of v0.0.2', () => {
    expect(beginnerConcepts()[0].id).toBe('lantern-hollow')
  })
})

describe('turning a template into a concept', () => {
  it('copies the title, pitch, genre, seed features and vision', () => {
    const template = findConcept('cold-bite')!
    const concept = conceptFromTemplate(template)
    expect(concept).toEqual({
      title: 'Cold Bite',
      idea: template.pitch,
      genre: 'Survival',
      seedFeatures: ['crafting', 'story', 'physics'],
      vision: template.vision,
    })
  })

  it('makes a copy: changing the concept never changes the gallery', () => {
    const template = findConcept('cold-bite')!
    const concept = conceptFromTemplate(template)
    ;(concept.seedFeatures as string[]).push('combat')
    expect(template.seedFeatures).toEqual(['crafting', 'story', 'physics'])
  })

  it('finds concepts by id', () => {
    expect(findConcept('idol-ranch')!.title).toBe('Idol Ranch')
    expect(findConcept('nope')).toBeUndefined()
    expect(findConcept(null)).toBeUndefined()
    expect(findConcept(undefined)).toBeUndefined()
  })
})

describe('rolling a random concept', () => {
  it('picks by the random number: the start of the range gives the first, the end gives the last', () => {
    expect(rollConcept(CONCEPTS, () => 0).id).toBe(CONCEPTS[0].id)
    expect(rollConcept(CONCEPTS, () => 0.999999).id).toBe(CONCEPTS[CONCEPTS.length - 1].id)
  })

  it('can reach every concept', () => {
    const seen = new Set<string>()
    for (let i = 0; i < CONCEPTS.length; i++) seen.add(rollConcept(CONCEPTS, () => (i + 0.5) / CONCEPTS.length).id)
    expect(seen.size).toBe(CONCEPTS.length)
  })

  it('never repeats the one you already have', () => {
    for (const c of CONCEPTS) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.999999]) expect(rollConcept(CONCEPTS, () => r, c.id).id).not.toBe(c.id)
    }
  })

  it('stays inside the pool it is given (the tutorial only rolls beginner concepts)', () => {
    const pool = beginnerConcepts()
    for (const r of [0, 0.3, 0.6, 0.99]) expect(pool.map((c) => c.id)).toContain(rollConcept(pool, () => r).id)
  })

  it('copes with a pool of one', () => {
    const only = [CONCEPTS[0]]
    expect(rollConcept(only, () => 0.5, CONCEPTS[0].id).id).toBe(CONCEPTS[0].id)
  })

  it('survives a random number of exactly 1', () => {
    expect(rollConcept(CONCEPTS, () => 1).id).toBe(CONCEPTS[CONCEPTS.length - 1].id)
  })
})
