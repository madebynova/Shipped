import { describe, expect, it } from 'vitest'
import {
  MAX_ARCHIVE,
  SAVE_KEY,
  SAVE_VERSION,
  addArchiveEntry,
  defaultSave,
  loadSave,
  parseSave,
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
    expect(save.archive[0]).toMatchObject({ title: 'Wild', score: 100, genre: 'Action', band: 'ROUGH', sprint: 1, kind: 'full' })
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
