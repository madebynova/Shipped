import type { MoraleTier } from './types'

export function clampMorale(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function moraleTier(morale: number): MoraleTier {
  if (morale >= 50) return 'FOCUSED'
  if (morale >= 25) return 'TIRED'
  return 'BURNED OUT'
}

/** How well the team executes at each morale tier. */
export function moraleEfficiency(tier: MoraleTier): number {
  switch (tier) {
    case 'FOCUSED':
      return 1
    case 'TIRED':
      return 0.85
    case 'BURNED OUT':
      return 0.55
  }
}
