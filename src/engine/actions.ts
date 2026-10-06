import { bugsFromBuild, fixPower } from './bugs'
import {
  BASE_QUALITY,
  BROKE_EFFICIENCY,
  EXPAND_QUALITY,
  HYPE_GAIN,
  MAX_HYPE,
  MAX_QUALITY,
  MORALE_DELTA,
  POLISHED_AT,
  POLISH_BUG_CLEANUP,
  POLISH_QUALITY,
  SLOTS_PER_SPRINT,
} from './config'
import { clampMorale, moraleEfficiency, moraleTier } from './morale'
import { BUILD_POWER, SCOPE_EFFICIENCY, buildCost, getScope } from './scope'
import { addFlavorLog, addLog, findFeature, plural, withFeature } from './state'
import type {
  Action,
  ActionResult,
  Feature,
  FeatureState,
  MoraleTier,
  ResourceDeltas,
  RunState,
  ScopeLevel,
} from './types'

/** Everything an action needs to know about the team and the codebase right now. */
interface Conditions {
  level: ScopeLevel
  tier: MoraleTier
  /** True when the studio is out of money and the team is working unpaid. */
  broke: boolean
  /** Combined multiplier applied to quality gains and bug fixing. */
  efficiency: number
}

function conditionsOf(state: RunState): Conditions {
  const { level } = getScope(state.features)
  const tier = moraleTier(state.morale)
  const broke = state.money <= 0
  const efficiency = SCOPE_EFFICIENCY[level] * moraleEfficiency(tier) * (broke ? BROKE_EFFICIENCY : 1)
  return { level, tier, broke, efficiency }
}

function stateForQuality(quality: number): FeatureState {
  return quality >= POLISHED_AT ? 'POLISHED' : 'PLAYABLE'
}

/** Why an action cannot be taken right now, or null if it can. */
export function validateAction(state: RunState, action: Action): string | null {
  // The same five actions work before launch ('developing') and after it ('live').
  if (state.phase === 'retired') return 'The game has been retired.'
  if (state.phase !== 'developing' && state.phase !== 'live') return 'The game has already shipped.'
  if (state.live?.pendingEvent) return 'Decide what to do about the event first.'
  if (state.actionsLeft <= 0) return 'No action slots left this sprint.'

  switch (action.type) {
    case 'BUILD': {
      const feature = findFeature(state, action.featureId)
      if (!feature) return 'Choose a feature to build.'
      if (state.live?.cancelled.includes(feature.id)) return `${feature.name} was cancelled for good.`
      if (feature.state !== 'PLANNED' && feature.quality >= MAX_QUALITY) {
        return `${feature.name} cannot be pushed any further.`
      }
      return null
    }
    case 'POLISH': {
      const feature = findFeature(state, action.featureId)
      if (!feature) return 'Choose a feature to polish.'
      if (feature.state === 'PLANNED') return `${feature.name} is not playable yet. BUILD it first.`
      if (feature.quality >= MAX_QUALITY) return `${feature.name} is already flawless.`
      return null
    }
    case 'FIX':
      return state.bugs > 0 ? null : 'There are no bugs to fix.'
    case 'HYPE':
      return state.hype < MAX_HYPE ? null : 'Hype is already maxed out.'
    case 'REST':
      return state.morale < 100 ? null : 'The team is already at full morale.'
  }
}

/**
 * True when slots are left but no action is legal: every feature is flawless or cancelled, there are no
 * bugs, morale is full and hype is maxed. It is very rare, but it must never trap a sprint open, so the
 * sprint is allowed to close early when this is true.
 */
export function isStuck(state: RunState): boolean {
  if ((state.phase !== 'developing' && state.phase !== 'live') || state.actionsLeft <= 0) return false
  if (state.live?.pendingEvent) return false
  const anyAction = (['FIX', 'HYPE', 'REST'] as const).some((type) => validateAction(state, { type }) === null)
  if (anyAction) return false
  return !state.features.some(
    (f) =>
      validateAction(state, { type: 'BUILD', featureId: f.id }) === null ||
      validateAction(state, { type: 'POLISH', featureId: f.id }) === null,
  )
}

/** BUILD on a PLANNED feature: advance progress. On a built feature: a fast, messy rework. */
function applyBuild(state: RunState, feature: Feature, c: Conditions): RunState {
  const bugsAdded = bugsFromBuild(c.level, c.tier)
  const bugText = `+${plural(bugsAdded, 'bug')}`
  let next: RunState = {
    ...state,
    morale: clampMorale(state.morale + MORALE_DELTA.BUILD),
    bugs: state.bugs + bugsAdded,
  }

  if (feature.state === 'PLANNED') {
    const cost = buildCost(feature)
    const power = Math.max(1, BUILD_POWER[c.level] - (c.tier === 'BURNED OUT' || c.broke ? 1 : 0))
    const progress = Math.min(cost, feature.progress + power)

    if (progress >= cost) {
      const quality = Math.round(BASE_QUALITY * c.efficiency)
      next = withFeature(next, {
        ...feature,
        progress,
        quality,
        state: stateForQuality(quality),
      })
      return addFlavorLog(
        next,
        [
          `${feature.name} is PLAYABLE (${bugText}).`,
          `${feature.name} works. Mostly. (${bugText})`,
          `${feature.name} is in the build, rough but real (${bugText}).`,
        ],
        'good',
      )
    }

    next = withFeature(next, { ...feature, progress })
    return addFlavorLog(
      next,
      [
        `${feature.name} is taking shape: ${progress}/${cost} (${bugText}).`,
        `${feature.name} moves forward: ${progress}/${cost} (${bugText}).`,
        `Another chunk of ${feature.name} lands: ${progress}/${cost} (${bugText}).`,
      ],
      'neutral',
    )
  }

  const quality = Math.min(MAX_QUALITY, feature.quality + Math.round(EXPAND_QUALITY * c.efficiency))
  const newState = stateForQuality(quality)
  next = withFeature(next, { ...feature, quality, state: newState })
  const reached = feature.state !== 'POLISHED' && newState === 'POLISHED'
  return addLog(
    next,
    reached
      ? `${feature.name} reaches POLISHED, built fast and messy (${bugText}).`
      : `${feature.name} reworked: quality ${quality} (${bugText}).`,
    reached ? 'good' : 'neutral',
  )
}

/** POLISH: slower than rework but clean, and it smooths off a bug. */
function applyPolish(state: RunState, feature: Feature, c: Conditions): RunState {
  const quality = Math.min(MAX_QUALITY, feature.quality + Math.round(POLISH_QUALITY * c.efficiency))
  const newState = stateForQuality(quality)
  const bugsBefore = state.bugs
  const bugs = Math.max(0, bugsBefore - POLISH_BUG_CLEANUP)
  const cleaned = bugsBefore - bugs
  const next = withFeature(
    {
      ...state,
      morale: clampMorale(state.morale + MORALE_DELTA.POLISH),
      bugs,
    },
    { ...feature, quality, state: newState },
  )
  const tail = cleaned > 0 ? ` and a bug disappears` : ''
  if (feature.state !== 'POLISHED' && newState === 'POLISHED') {
    return addLog(next, `${feature.name} reaches POLISHED${tail}.`, 'good')
  }
  return addFlavorLog(
    next,
    [
      `${feature.name} refined: quality ${quality}${tail}.`,
      `Rough edges sanded off ${feature.name}: quality ${quality}${tail}.`,
    ],
    'good',
  )
}

function applyFix(state: RunState, c: Conditions): RunState {
  const removed = Math.min(state.bugs, fixPower(c.level, c.tier, c.broke))
  const next: RunState = {
    ...state,
    bugs: state.bugs - removed,
    morale: clampMorale(state.morale + MORALE_DELTA.FIX),
  }
  return addFlavorLog(
    next,
    [`The team squashes ${plural(removed, 'bug')}.`, `Bug hunt: ${removed} fixed. Nothing new gets built.`],
    'good',
  )
}

function applyHype(state: RunState): RunState {
  const hype = Math.min(MAX_HYPE, state.hype + HYPE_GAIN)
  const title = state.concept.title
  const next: RunState = {
    ...state,
    hype,
    morale: clampMorale(state.morale + MORALE_DELTA.HYPE),
  }
  // After launch HYPE is a marketing push: the same action, with live-service flavour text.
  if (state.phase === 'live') {
    return addFlavorLog(
      next,
      [
        `A dev blog goes up. People are talking about ${title} again.`,
        `You post a roadmap and tease the next update. The buzz comes back.`,
        `${title} gets a front-page feature. Sales notice.`,
      ],
      'good',
    )
  }
  return addFlavorLog(
    next,
    [
      `A teaser drops. People are talking about ${title}. Expectations rise.`,
      `You tell the world about ${title}. The game itself is no better.`,
      `${title} trends for an afternoon. Now it has to deliver.`,
    ],
    'warn',
  )
}

function applyRest(state: RunState): RunState {
  const next: RunState = { ...state, morale: clampMorale(state.morale + MORALE_DELTA.REST) }
  return addFlavorLog(
    next,
    [
      'The team takes a breather. Nothing gets built.',
      'Everyone sleeps. Progress stands still, spirits climb.',
      'A quiet sprint day. The team comes back sharper.',
    ],
    'good',
  )
}

/**
 * Spend one action slot. Pure: returns a new state, or the same state with
 * ok = false and a reason if the action is not allowed.
 */
export function applyAction(state: RunState, action: Action): ActionResult {
  const reason = validateAction(state, action)
  if (reason) return { ok: false, state, reason }

  const conditions = conditionsOf(state)
  const feature = findFeature(state, action.featureId)
  let next: RunState

  switch (action.type) {
    case 'BUILD':
      next = applyBuild(state, feature!, conditions)
      break
    case 'POLISH':
      next = applyPolish(state, feature!, conditions)
      break
    case 'FIX':
      next = applyFix(state, conditions)
      break
    case 'HYPE':
      next = applyHype(state)
      break
    case 'REST':
      next = applyRest(state)
      break
  }

  return {
    ok: true,
    state: {
      ...next,
      actionsLeft: state.actionsLeft - 1,
      history: [
        ...next.history,
        {
          kind: 'action',
          sprint: state.sprint,
          slot: SLOTS_PER_SPRINT - state.actionsLeft + 1,
          action: { ...action },
        },
      ],
    },
  }
}

export interface ActionPreview {
  ok: boolean
  reason?: string
  deltas: ResourceDeltas
  scopeBefore: ScopeLevel
  scopeAfter: ScopeLevel
  feature?: { before: Feature; after: Feature }
}

/** What would this action do right now? (Apply it to a copy and diff.) */
export function previewAction(state: RunState, action: Action): ActionPreview {
  const scopeBefore = getScope(state.features).level
  const result = applyAction(state, action)
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      deltas: { money: 0, morale: 0, hype: 0, bugs: 0 },
      scopeBefore,
      scopeAfter: scopeBefore,
    }
  }
  const after = result.state
  const before = findFeature(state, action.featureId)
  const afterFeature = findFeature(after, action.featureId)
  return {
    ok: true,
    deltas: {
      money: after.money - state.money,
      morale: after.morale - state.morale,
      hype: after.hype - state.hype,
      bugs: after.bugs - state.bugs,
    },
    scopeBefore,
    scopeAfter: getScope(after.features).level,
    feature: before && afterFeature ? { before, after: afterFeature } : undefined,
  }
}
