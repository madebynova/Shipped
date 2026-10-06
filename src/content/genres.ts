import type { Genre } from '../engine/types'

export interface GenreDef {
  id: Genre
  blurb: string
  /** Starting point for the ORIGINALITY score: how much room the genre leaves you. */
  originalityBase: number
}

export const GENRES: readonly GenreDef[] = [
  { id: 'Action', blurb: 'Reflexes and impact.', originalityBase: 50 },
  { id: 'RPG', blurb: 'Builds, quests and loot.', originalityBase: 54 },
  { id: 'Racing', blurb: 'Speed, lines and rivals.', originalityBase: 56 },
  { id: 'Survival', blurb: 'Scarcity and dread.', originalityBase: 52 },
  { id: 'Strategy', blurb: 'Plans that survive contact.', originalityBase: 58 },
  { id: 'Simulation', blurb: 'Systems you can poke.', originalityBase: 60 },
]

export function getGenre(id: Genre): GenreDef {
  return GENRES.find((g) => g.id === id) ?? GENRES[0]
}
