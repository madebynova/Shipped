import type { FeatureId, Genre } from '../engine/types'

export interface GenreDef {
  id: Genre
  blurb: string
  /** Starting point for the ORIGINALITY score: how much room the genre leaves you. */
  originalityBase: number
  /**
   * How big the genre's audience is, as a multiplier on first-week sales. RPG and Survival fans
   * buy a lot of games; Racing and Strategy are more of a niche.
   */
  market: number
  /**
   * The two features players expect from this genre. A concept written by hand has no seed
   * features of its own, so these are what it promises (see engine/promises.ts).
   */
  signature: readonly [FeatureId, FeatureId]
}

export const GENRES: readonly GenreDef[] = [
  { id: 'Action', blurb: 'Reflexes and impact.', originalityBase: 50, market: 1.05, signature: ['combat', 'physics'] },
  { id: 'RPG', blurb: 'Builds, quests and loot.', originalityBase: 54, market: 1.1, signature: ['story', 'combat'] },
  { id: 'Racing', blurb: 'Speed, lines and rivals.', originalityBase: 56, market: 0.9, signature: ['vehicles', 'physics'] },
  { id: 'Survival', blurb: 'Scarcity and dread.', originalityBase: 52, market: 1.1, signature: ['crafting', 'combat'] },
  { id: 'Strategy', blurb: 'Plans that survive contact.', originalityBase: 58, market: 0.9, signature: ['story', 'crafting'] },
  { id: 'Simulation', blurb: 'Systems you can poke.', originalityBase: 60, market: 0.95, signature: ['crafting', 'customization'] },
]

export function getGenre(id: Genre): GenreDef {
  return GENRES.find((g) => g.id === id) ?? GENRES[0]
}
