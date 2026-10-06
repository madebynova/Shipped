import type { ReviewBand } from '../engine'

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
