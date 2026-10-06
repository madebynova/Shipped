import { DEFAULT_THEME, isThemeId } from './themes'
import type { ThemeId } from './themes'
import type { Genre, ReviewBand, RunKind } from './engine'

// Everything SHIPPED remembers between visits, in one small JSON blob in localStorage.
//
// v0.0.1 did not persist anything, so there are no real "old" saves in the wild. The loader
// is nevertheless written to survive any shape it meets: missing keys, wrong types, corrupt
// JSON, a save from a future or past version, or storage that throws (private browsing).
// Unknown or invalid fields fall back to safe defaults; they never crash the game.

export const SAVE_KEY = 'shipped:save'
export const SAVE_VERSION = 1
export const MAX_ARCHIVE = 30

export interface ArchiveEntry {
  id: string
  title: string
  genre: Genre
  score: number
  band: ReviewBand
  /** Sprint the game shipped in. */
  sprint: number
  kind: RunKind
  /** ISO date string. */
  date: string
}

export interface SaveData {
  version: number
  /** The "MY FIRST GAME" tutorial has been passed; the full game is unlocked. */
  tutorialCompleted: boolean
  theme: ThemeId
  /** Newest first. */
  archive: ArchiveEntry[]
}

/** The tiny slice of localStorage we use, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const GENRES: readonly Genre[] = ['Action', 'RPG', 'Racing', 'Survival', 'Strategy', 'Simulation']
const BANDS: readonly ReviewBand[] = ['MASTERPIECE', 'GREAT', 'SOLID', 'ROUGH', 'DISASTER', 'LEGENDARY FAILURE']

export function defaultSave(): SaveData {
  return { version: SAVE_VERSION, tutorialCompleted: false, theme: DEFAULT_THEME, archive: [] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseEntry(raw: unknown, index: number): ArchiveEntry | null {
  if (!isRecord(raw)) return null
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const score = typeof raw.score === 'number' && Number.isFinite(raw.score) ? Math.round(raw.score) : null
  if (!title || score === null) return null
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `legacy-${index}`,
    title: title.slice(0, 60),
    genre: GENRES.includes(raw.genre as Genre) ? (raw.genre as Genre) : 'Action',
    score: Math.max(0, Math.min(100, score)),
    band: BANDS.includes(raw.band as ReviewBand) ? (raw.band as ReviewBand) : 'ROUGH',
    sprint: typeof raw.sprint === 'number' && raw.sprint >= 1 ? Math.floor(raw.sprint) : 1,
    // Older entries have no kind: they were full games.
    kind: raw.kind === 'tutorial' ? 'tutorial' : 'full',
    date: typeof raw.date === 'string' ? raw.date : '',
  }
}

/**
 * Turn anything into a valid SaveData. A save that has no `tutorialCompleted` flag but does
 * contain finished runs belongs to a returning player, so the tutorial is skipped for them.
 */
export function parseSave(raw: unknown): SaveData {
  const save = defaultSave()
  if (!isRecord(raw)) return save

  if (isThemeId(raw.theme)) save.theme = raw.theme

  const archiveSource = Array.isArray(raw.archive) ? raw.archive : Array.isArray(raw.runs) ? raw.runs : []
  save.archive = archiveSource
    .map((entry, i) => parseEntry(entry, i))
    .filter((entry): entry is ArchiveEntry => entry !== null)
    .slice(0, MAX_ARCHIVE)

  if (typeof raw.tutorialCompleted === 'boolean') {
    save.tutorialCompleted = raw.tutorialCompleted
  } else {
    save.tutorialCompleted = save.archive.length > 0
  }
  return save
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null // accessing localStorage can itself throw (blocked cookies, sandboxed iframes)
  }
}

export function loadSave(storage: StorageLike | null = browserStorage()): SaveData {
  if (!storage) return defaultSave()
  try {
    const text = storage.getItem(SAVE_KEY)
    if (!text) return defaultSave()
    return parseSave(JSON.parse(text))
  } catch {
    return defaultSave()
  }
}

/** Returns false if the browser refused (quota, private mode); the game carries on without saving. */
export function writeSave(save: SaveData, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save))
    return true
  } catch {
    return false
  }
}

/** Newest first, capped. */
export function addArchiveEntry(save: SaveData, entry: ArchiveEntry): SaveData {
  return { ...save, archive: [entry, ...save.archive].slice(0, MAX_ARCHIVE) }
}
