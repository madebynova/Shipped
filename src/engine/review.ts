import { originalityScore } from './originality'
import { buildVerdict } from './reviewText'
import type { Feature, ReviewBand, Review, RunState } from './types'

// The review is a pure function of the final run state. No randomness, no network.

const WEIGHTS = { gameplay: 0.35, content: 0.25, polish: 0.25, originality: 0.15 } as const

/** Raw feature weight at which GAMEPLAY / CONTENT saturate (about three or four good features). */
const FULL_GAME = 9
/** Below 1 so the first features count for a lot and the last ones for less. */
const CURVE = 0.75

const GAMEPLAY_BUG_PENALTY = 0.035 // per bug
const GAMEPLAY_BUG_CAP = 0.7
const POLISH_BUG_PENALTY = 0.045 // per bug
const POLISH_BUG_CAP = 0.8
const CONTENT_BUG_PENALTY = 0.012 // per bug: content buried under bugs is content nobody sees
const CONTENT_BUG_CAP = 0.5

// Hype raises the bar the audience judges you against.
const HYPE_BAR_BASE = 50
const HYPE_BAR_PER_HYPE = 0.3
const HYPE_BONUS_CAP = 12
const HYPE_PENALTY_CAP = 40
const HYPE_DISAPPOINTMENT = 1.3 // missing a hyped bar hurts more than beating it helps

export const BAND_THRESHOLDS: readonly { min: number; band: ReviewBand }[] = [
  { min: 90, band: 'MASTERPIECE' },
  { min: 75, band: 'GREAT' },
  { min: 60, band: 'SOLID' },
  { min: 45, band: 'ROUGH' },
  { min: 25, band: 'DISASTER' },
  { min: 0, band: 'LEGENDARY FAILURE' },
]

export function bandFor(score: number): ReviewBand {
  return (BAND_THRESHOLDS.find((t) => score >= t.min) ?? BAND_THRESHOLDS[BAND_THRESHOLDS.length - 1]).band
}

function builtFeatures(features: readonly Feature[]): Feature[] {
  return features.filter((f) => f.state !== 'PLANNED')
}

/** 0.35 for a broken feature up to 1.0 for a flawless one. */
function qualityFactor(quality: number): number {
  return 0.35 + 0.65 * (quality / 100)
}

function curve(raw: number): number {
  return 100 * Math.pow(Math.min(1, raw / FULL_GAME), CURVE)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function computeReview(state: RunState, forced = false): Review {
  const built = builtFeatures(state.features)
  const bugs = state.bugs

  const gameplayRaw = built.reduce((sum, f) => sum + f.gameplayWeight * qualityFactor(f.quality), 0)
  const contentRaw = built.reduce((sum, f) => sum + f.contentWeight, 0)
  const totalComplexity = built.reduce((sum, f) => sum + f.complexity, 0)
  const averageQuality =
    totalComplexity > 0
      ? built.reduce((sum, f) => sum + f.quality * f.complexity, 0) / totalComplexity
      : 0

  const gameplay = curve(gameplayRaw) * (1 - Math.min(GAMEPLAY_BUG_CAP, GAMEPLAY_BUG_PENALTY * bugs))
  const content = curve(contentRaw) * (1 - Math.min(CONTENT_BUG_CAP, CONTENT_BUG_PENALTY * bugs))
  const polish = averageQuality * (1 - Math.min(POLISH_BUG_CAP, POLISH_BUG_PENALTY * bugs))
  const originality = originalityScore(state.concept)

  const base = Math.round(
    gameplay * WEIGHTS.gameplay +
      content * WEIGHTS.content +
      polish * WEIGHTS.polish +
      originality * WEIGHTS.originality,
  )

  // "Oh no, I told people about my game."
  const hypeBar = Math.round(HYPE_BAR_BASE + state.hype * HYPE_BAR_PER_HYPE)
  const gap = base - hypeBar
  const hypeShare = state.hype / 100
  const hypeModifier =
    Math.round(
      gap >= 0
        ? Math.min(HYPE_BONUS_CAP, gap * hypeShare)
        : Math.max(-HYPE_PENALTY_CAP, gap * hypeShare * HYPE_DISAPPOINTMENT),
    ) || 0 // || 0 turns -0 into 0

  const score = clamp(base + hypeModifier, 0, 100)

  const review: Review = {
    score,
    band: bandFor(score),
    gameplay: Math.round(gameplay),
    content: Math.round(content),
    polish: Math.round(polish),
    originality,
    baseScore: base,
    hypeModifier,
    hypeBar,
    verdict: [],
    shippedSprint: state.sprint,
    forced,
  }
  review.verdict = buildVerdict(state, review)
  return review
}
