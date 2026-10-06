import { describe, expect, it } from 'vitest'
import {
  MAX_ARCHIVE,
  SAVE_KEY,
  SAVE_VERSION,
  addArchiveEntry,
  defaultSave,
  loadSave,
  parseSave,
  updateArchiveLegacy,
  writeSave,
} from './save'
import type { ArchiveEntry, StorageLike } from './save'

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v
    },
  }
}

const entry = (overrides: Partial<ArchiveEntry> = {}): ArchiveEntry => ({
  id: 'a',
  title: 'Iron Pulse',
  genre: 'Action',
  score: 72,
  band: 'SOLID',
  sprint: 8,
  kind: 'full',
  date: '2026-10-06T12:00:00.000Z',
  legacyScore: 72,
  legacyBand: 'SOLID',
  complete: false,
  ...overrides,
})

describe('a brand-new player', () => {
  it('has no save: tutorial required, default theme, empty archive', () => {
    const save = loadSave(memoryStorage())
    expect(save).toEqual(defaultSave())
    expect(save.tutorialCompleted).toBe(false)
    expect(save.theme).toBe('midnight')
    expect(save.archive).toEqual([])
    expect(save.version).toBe(SAVE_VERSION)
  })

  it('survives having no storage at all', () => {
    expect(loadSave(null)).toEqual(defaultSave())
    expect(writeSave(defaultSave(), null)).toBe(false)
  })
})

describe('round trip', () => {
  it('writes and reads back exactly what it saved', () => {
    const storage = memoryStorage()
    const save = {
      ...defaultSave(),
      tutorialCompleted: true,
      theme: 'sunset' as const,
      archive: [entry({ kind: 'tutorial', id: 't1' }), entry()],
    }
    expect(writeSave(save, storage)).toBe(true)
    expect(JSON.parse(storage.data[SAVE_KEY])).toEqual(save)
    expect(loadSave(storage)).toEqual(save)
  })
})

describe('old and damaged saves never break the game', () => {
  it('ignores corrupt JSON', () => {
    expect(loadSave(memoryStorage({ [SAVE_KEY]: '{not json' }))).toEqual(defaultSave())
    expect(loadSave(memoryStorage({ [SAVE_KEY]: '' }))).toEqual(defaultSave())
  })

  it('ignores JSON of the wrong shape', () => {
    for (const bad of ['null', '42', '"hello"', '[]', 'true']) {
      expect(loadSave(memoryStorage({ [SAVE_KEY]: bad }))).toEqual(defaultSave())
    }
  })

  it('survives storage that throws', () => {
    const angry: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(loadSave(angry)).toEqual(defaultSave())
    expect(writeSave(defaultSave(), angry)).toBe(false)
  })

  it('treats a legacy save with played runs but no tutorial flag as a returning player', () => {
    const legacy = {
      runs: [
        { title: 'Old Game', score: 61, genre: 'RPG', band: 'SOLID', sprint: 8 },
        { title: 'Older Game', score: 33 },
      ],
    }
    const save = parseSave(legacy)
    expect(save.tutorialCompleted).toBe(true) // tutorial skipped
    expect(save.theme).toBe('midnight') // default theme applied
    expect(save.archive).toHaveLength(2)
    expect(save.archive.every((e) => e.kind === 'full')).toBe(true)
    expect(save.archive[1].genre).toBe('Action') // missing fields get safe defaults
  })

  it('also understands a legacy save that already used the "archive" name', () => {
    const save = parseSave({ archive: [{ title: 'Keeper', score: 80 }], theme: 'terminal' })
    expect(save.tutorialCompleted).toBe(true)
    expect(save.theme).toBe('terminal')
  })

  it('keeps an empty legacy save as a new player', () => {
    expect(parseSave({ runs: [] }).tutorialCompleted).toBe(false)
    expect(parseSave({}).tutorialCompleted).toBe(false)
  })

  it('trusts an explicit tutorialCompleted flag over everything else', () => {
    expect(parseSave({ tutorialCompleted: false, archive: [{ title: 'x', score: 1 }] }).tutorialCompleted).toBe(false)
    expect(parseSave({ tutorialCompleted: true }).tutorialCompleted).toBe(true)
  })

  it('replaces an unknown or malformed theme with the default', () => {
    expect(parseSave({ theme: 'hot-pink-vomit' }).theme).toBe('midnight')
    expect(parseSave({ theme: 42 }).theme).toBe('midnight')
    expect(parseSave({ theme: 'paper' }).theme).toBe('paper')
  })

  it('drops broken archive entries and clamps odd values', () => {
    const save = parseSave({
      tutorialCompleted: true,
      archive: [
        null,
        'nope',
        { title: '', score: 50 },
        { title: 'No score' },
        { title: 'Wild', score: 9999, genre: 'Cooking', band: 'EPIC', sprint: -4, kind: 'weird' },
      ],
    })
    expect(save.archive).toHaveLength(1)
    expect(save.archive[0]).toMatchObject({
      title: 'Wild',
      score: 100,
      genre: 'Action',
      band: 'ROUGH',
      sprint: 1,
      kind: 'full',
      legacyScore: 100, // no legacy field: the legacy score is the launch score
      complete: false,
    })
  })

  it('never lets future fields or unknown keys through', () => {
    const save = parseSave({ tutorialCompleted: true, evil: '<script>', theme: 'sunset', version: 99 })
    expect(Object.keys(save).sort()).toEqual(['archive', 'theme', 'tutorialCompleted', 'version'])
    expect(save.version).toBe(SAVE_VERSION)
  })
})

describe('archive', () => {
  it('puts the newest run first', () => {
    const save = addArchiveEntry(addArchiveEntry(defaultSave(), entry({ id: '1' })), entry({ id: '2' }))
    expect(save.archive.map((e) => e.id)).toEqual(['2', '1'])
  })

  it('is capped so the save cannot grow forever', () => {
    let save = defaultSave()
    for (let i = 0; i < MAX_ARCHIVE + 10; i++) save = addArchiveEntry(save, entry({ id: String(i) }))
    expect(save.archive).toHaveLength(MAX_ARCHIVE)
    expect(save.archive[0].id).toBe(String(MAX_ARCHIVE + 9))
  })

  it('does not mutate the save it was given', () => {
    const before = defaultSave()
    addArchiveEntry(before, entry())
    expect(before.archive).toEqual([])
  })
})

describe('the archive keeps TWO scores forever: launch and legacy', () => {
  it('loads a save written by v0.0.2 (no legacy fields) with the legacy score equal to the launch score', () => {
    // This is the exact shape v0.0.2 wrote.
    const v002 = {
      version: 1,
      tutorialCompleted: true,
      theme: 'sunset',
      archive: [
        { id: '123-40', title: 'Iron Pulse', genre: 'Action', score: 79, band: 'GREAT', sprint: 8, kind: 'full', date: '2026-10-05T10:00:00.000Z' },
        { id: '99-12', title: 'Lantern Hollow', genre: 'RPG', score: 58, band: 'ROUGH', sprint: 6, kind: 'tutorial', date: '2026-10-05T09:00:00.000Z' },
      ],
    }
    const save = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(v002) }))
    expect(save.tutorialCompleted).toBe(true) // still skips the tutorial
    expect(save.theme).toBe('sunset')
    expect(save.version).toBe(SAVE_VERSION)
    expect(save.archive).toHaveLength(2)
    expect(save.archive[0]).toMatchObject({ title: 'Iron Pulse', score: 79, band: 'GREAT', legacyScore: 79, legacyBand: 'GREAT', complete: false })
    expect(save.archive[1]).toMatchObject({ kind: 'tutorial', score: 58, legacyScore: 58, legacyBand: 'ROUGH', complete: false })
  })

  it('upgrades an old save the next time it is written, without losing anything', () => {
    const storage = memoryStorage({
      [SAVE_KEY]: JSON.stringify({ version: 1, tutorialCompleted: true, theme: 'paper', archive: [{ title: 'Old', score: 61 }] }),
    })
    const loaded = loadSave(storage)
    writeSave(loaded, storage)
    const written = JSON.parse(storage.data[SAVE_KEY])
    expect(written.version).toBe(SAVE_VERSION)
    expect(written.archive[0]).toMatchObject({ title: 'Old', score: 61, legacyScore: 61, complete: false })
    expect(loadSave(storage)).toEqual(loaded)
  })

  it('keeps legacy scores through a round trip', () => {
    const storage = memoryStorage()
    const save = { ...defaultSave(), tutorialCompleted: true, archive: [entry({ score: 61, band: 'SOLID', legacyScore: 93, legacyBand: 'MASTERPIECE', complete: true })] }
    writeSave(save, storage)
    expect(loadSave(storage)).toEqual(save)
    expect(loadSave(storage).archive[0]).toMatchObject({ score: 61, legacyScore: 93, complete: true })
  })

  it('derives the legacy band from the legacy score when the band is missing', () => {
    expect(parseSave({ archive: [{ title: 'A', score: 50, legacyScore: 91 }] }).archive[0].legacyBand).toBe('MASTERPIECE')
    expect(parseSave({ archive: [{ title: 'A', score: 50, legacyScore: 30 }] }).archive[0].legacyBand).toBe('DISASTER')
  })

  it('falls back safely when legacy fields are damaged', () => {
    const bad = (extra: Record<string, unknown>) => parseSave({ archive: [{ title: 'A', score: 66, ...extra }] }).archive[0]
    expect(bad({ legacyScore: 'high' }).legacyScore).toBe(66)
    expect(bad({ legacyScore: Number.NaN }).legacyScore).toBe(66)
    expect(bad({ legacyScore: null }).legacyScore).toBe(66)
    expect(bad({ legacyScore: 5000 }).legacyScore).toBe(100)
    expect(bad({ legacyScore: -40 }).legacyScore).toBe(0)
    expect(bad({ legacyScore: 70.6 }).legacyScore).toBe(71)
    expect(bad({ legacyBand: 'EPIC', legacyScore: 80 }).legacyBand).toBe('GREAT')
    expect(bad({ complete: 'yes' }).complete).toBe(false)
    expect(bad({ complete: 1 }).complete).toBe(false)
    expect(bad({ complete: true }).complete).toBe(true)
  })

  it('never touches the launch score when the legacy is updated', () => {
    const before = { ...defaultSave(), archive: [entry({ id: 'a', score: 61, band: 'SOLID' }), entry({ id: 'b', score: 40, band: 'DISASTER', legacyScore: 40, legacyBand: 'DISASTER' })] }
    const after = updateArchiveLegacy(before, 'a', { legacyScore: 90, legacyBand: 'MASTERPIECE', complete: true })
    expect(after.archive[0]).toMatchObject({ id: 'a', score: 61, band: 'SOLID', legacyScore: 90, legacyBand: 'MASTERPIECE', complete: true })
    expect(after.archive[1]).toEqual(before.archive[1]) // the other game is untouched
    expect(before.archive[0].legacyScore).toBe(72) // and the original save was not mutated
  })

  it('ignores an update for a game that is not in the archive', () => {
    const save = { ...defaultSave(), archive: [entry({ id: 'a' })] }
    expect(updateArchiveLegacy(save, 'zzz', { legacyScore: 1, legacyBand: 'LEGENDARY FAILURE', complete: false })).toBe(save)
  })
})
