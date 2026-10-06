import { DEFAULT_THEME, isThemeId } from './themes'
import type { ThemeId } from './themes'
import { bandFor } from './engine'
import type { Genre, ReviewBand, RunKind } from './engine'

// Everything SHIPPED remembers between visits, in one small JSON blob in localStorage.
//
// v0.0.1 did not persist anything, so there are no real "old" saves in the wild. The loader
// is nevertheless written to survive any shape it meets: missing keys, wrong types, corrupt
// JSON, a save from a future or past version, or storage that throws (private browsing).
// Unknown or invalid fields fall back to safe defaults; they never crash the game.

export const SAVE_KEY = 'shipped:save'
export const SAVE_VERSION = 2 // 2: archive entries carry a legacy score as well as the launch score
export const MAX_ARCHIVE = 30

export interface ArchiveEntry {
  id: string
  title: string
  genre: Genre
  /** The LAUNCH score: the review at ship. It is the first impression and it never changes. */
  score: number
  /** The band of the launch score. */
  band: ReviewBand
  /** Sprint the game shipped in. */
  sprint: number
  kind: RunKind
  /** ISO date string. */
  date: string
  /** The LEGACY score: where the game's reputation ended up after live updates. Equal to `score` if it never got any. */
  legacyScore: number
  legacyBand: ReviewBand
  /** The game earned the COMPLETE stamp: every feature polished, no bugs, no broken promises. */
  complete: boolean
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
  const launch = Math.max(0, Math.min(100, score))
  // Older saves (v0.0.2 and before) have no legacy fields: those games were never updated, so the
  // legacy score is simply the launch score.
  const legacy =
    typeof raw.legacyScore === 'number' && Number.isFinite(raw.legacyScore)
      ? Math.max(0, Math.min(100, Math.round(raw.legacyScore)))
      : launch
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `legacy-${index}`,
    title: title.slice(0, 60),
    genre: GENRES.includes(raw.genre as Genre) ? (raw.genre as Genre) : 'Action',
    score: launch,
    band: BANDS.includes(raw.band as ReviewBand) ? (raw.band as ReviewBand) : 'ROUGH',
    legacyScore: legacy,
    legacyBand: BANDS.includes(raw.legacyBand as ReviewBand) ? (raw.legacyBand as ReviewBand) : bandFor(legacy),
    complete: raw.complete === true,
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

/**
 * Update the LEGACY half of an entry (after a release, or when the game is retired). The launch score, band
 * and everything else on the entry are left exactly as they were: the first impression is permanent.
 */
export function updateArchiveLegacy(
  save: SaveData,
  id: string,
  legacy: Pick<ArchiveEntry, 'legacyScore' | 'legacyBand' | 'complete'>,
): SaveData {
  if (!save.archive.some((entry) => entry.id === id)) return save
  return {
    ...save,
    archive: save.archive.map((entry) =>
      entry.id === id
        ? { ...entry, legacyScore: legacy.legacyScore, legacyBand: legacy.legacyBand, complete: legacy.complete }
        : entry,
    ),
  }
}
