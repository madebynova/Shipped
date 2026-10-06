import type { FeatureId, ReviewBand } from '../engine'

/** +3 / −3 / 0 with a real minus sign. */
export function signed(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `−${Math.abs(n)}`
  return '0'
}

export function formatMoney(n: number): string {
  return n < 0 ? `−$${Math.abs(n)}` : `$${n}`
}

export type Mood = 'good' | 'warn' | 'bad' | 'neutral'

/**
 * What the player should know about their cash right now.
 * `upkeep` is what closing a sprint costs at the current scope (it grows as the game does);
 * `sprintsToDeadline` is how many more sprint-closes happen before the game ships.
 */
export function moneyStatus(
  money: number,
  upkeep: number,
  sprintsToDeadline: number,
): { label: string; mood: Mood } {
  if (money <= 0) return { label: 'BROKE: TEAM UNPAID', mood: 'bad' }
  const closes = Math.ceil(money / upkeep)
  // Enough cash to reach the deadline at today's upkeep: the honest thing to say is "you're fine".
  if (closes > sprintsToDeadline) return { label: 'COVERED TO THE DEADLINE', mood: 'good' }
  if (closes <= 1) return { label: 'BROKE AFTER THIS SPRINT', mood: 'bad' }
  if (closes <= 2) return { label: `BROKE IN ${closes} SPRINTS`, mood: 'warn' }
  return { label: `RUNWAY ${closes} SPRINTS`, mood: 'neutral' }
}

/**
 * What the player should know about the revenue account of a live game. `runway` is how many more sprints it can
 * pay for if nothing new happens (see liveRunway in the engine).
 */
export function liveMoneyStatus(money: number, runway: number): { label: string; mood: Mood } {
  if (money <= 0) return { label: 'EMPTY: TEAM UNPAID', mood: 'bad' }
  if (runway <= 0) return { label: 'CANNOT COVER THIS SPRINT', mood: 'bad' }
  if (runway === 1) return { label: 'ONE MORE SPRINT', mood: 'bad' }
  if (runway === 2) return { label: 'TWO MORE SPRINTS', mood: 'warn' }
  if (runway >= 99) return { label: 'COVERED FOR GOOD', mood: 'good' }
  if (runway >= 8) return { label: `RUNWAY ${runway} SPRINTS`, mood: 'good' }
  return { label: `RUNWAY ${runway} SPRINTS`, mood: 'neutral' }
}

/** Hype after launch is "buzz". */
export function buzzStatus(hype: number): { label: string; mood: Mood } {
  if (hype <= 0) return { label: 'QUIET', mood: 'neutral' }
  if (hype < 25) return { label: 'WHISPERS', mood: 'neutral' }
  if (hype < 50) return { label: 'BUZZING', mood: 'good' }
  if (hype < 75) return { label: 'ON EVERY LIST', mood: 'good' }
  return { label: 'EVERYWHERE', mood: 'warn' }
}

export function hypeStatus(hype: number): { label: string; mood: Mood } {
  if (hype <= 0) return { label: 'NOBODY KNOWS YET', mood: 'neutral' }
  if (hype < 25) return { label: 'WHISPERS', mood: 'neutral' }
  if (hype < 50) return { label: 'BUZZING', mood: 'warn' }
  if (hype < 75) return { label: 'HIGH EXPECTATIONS', mood: 'warn' }
  return { label: 'IMPOSSIBLE EXPECTATIONS', mood: 'bad' }
}

export function stabilityMood(label: string): Mood {
  if (label === 'STABLE') return 'good'
  if (label === 'SHAKY') return 'neutral'
  if (label === 'BUGGY') return 'warn'
  return 'bad'
}

export function moraleMood(tier: string): Mood {
  if (tier === 'FOCUSED') return 'good'
  if (tier === 'TIRED') return 'warn'
  return 'bad'
}

/** CSS-friendly slug: "LEGENDARY FAILURE" -> "legendary-failure". */
export function slug(text: ReviewBand | string): string {
  return text.toLowerCase().replace(/\s+/g, '-')
}

/** A short, chip-sized name for a feature ("Character Customization" is too long for a chip). */
export function featureLabel(id: FeatureId): string {
  switch (id) {
    case 'customization':
      return 'Customization'
    default:
      return id.charAt(0).toUpperCase() + id.slice(1)
  }
}

/** "1 sprint", "3 sprints". */
export function sprintsText(n: number): string {
  return `${n} ${n === 1 ? 'sprint' : 'sprints'}`
}
