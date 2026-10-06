import { BUILD_COST_PER_COMPLEXITY } from './config'
import type { Feature, ScopeLevel } from './types'

export const SCOPE_LEVELS: readonly ScopeLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

/** How much a bigger game slows you down: scales quality gains and bug fixing. */
export const SCOPE_EFFICIENCY: Record<ScopeLevel, number> = {
  LOW: 1,
  MEDIUM: 0.9,
  HIGH: 0.75,
  CRITICAL: 0.55,
}

/** Build points one BUILD action produces at each scope level. */
export const BUILD_POWER: Record<ScopeLevel, number> = {
  LOW: 5,
  MEDIUM: 4,
  HIGH: 3,
  CRITICAL: 2,
}

export const SCOPE_HINT: Record<ScopeLevel, string> = {
  LOW: 'Lean and fast. Everything works at full speed.',
  MEDIUM: 'The game is growing. Work is a little slower.',
  HIGH: 'You are taking on a lot. Builds crawl and bugs multiply.',
  CRITICAL: 'Too much game. Everything is slow, buggy and fragile.',
}

export function buildCost(feature: Pick<Feature, 'complexity'>): number {
  return feature.complexity * BUILD_COST_PER_COMPLEXITY
}

/**
 * Scope pressure: every feature that exists adds its complexity, and a feature
 * that is still being built adds its share so far. So every BUILD pushes it up.
 */
export function scopeLoad(features: readonly Feature[]): number {
  let load = 0
  for (const f of features) {
    load += f.state === 'PLANNED' ? f.progress / BUILD_COST_PER_COMPLEXITY : f.complexity
  }
  return load
}

export function scopeLevelFor(load: number): ScopeLevel {
  if (load < 4) return 'LOW'
  if (load < 8) return 'MEDIUM'
  if (load < 11) return 'HIGH'
  return 'CRITICAL'
}

export function getScope(features: readonly Feature[]): { load: number; level: ScopeLevel } {
  const load = scopeLoad(features)
  return { load, level: scopeLevelFor(load) }
}

export function scopeIndex(level: ScopeLevel): number {
  return SCOPE_LEVELS.indexOf(level)
}
