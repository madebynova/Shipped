import { getGenre } from '../content/genres'
import type { Concept } from './types'

const STOPWORDS = new Set([
  'the', 'and', 'a', 'an', 'of', 'to', 'in', 'is', 'it', 'for', 'with', 'that', 'this',
  'where', 'every', 'game', 'on', 'you', 'your', 'are', 'as', 'at', 'by', 'be', 'from',
  'was', 'but', 'not', 'has', 'have', 'can', 'will', 'who', 'what', 'all', 'one',
])

/**
 * ORIGINALITY (0-100) for v0.0.1: a deterministic score from the genre and the
 * core idea. Specific ideas with a wide vocabulary score higher; one-word ideas
 * and copy-pasted repetition score lower.
 */
export function originalityScore(concept: Concept): number {
  const idea = concept.idea.trim()
  const words = idea.toLowerCase().match(/[a-z]+/g) ?? []
  const distinctWords = new Set(words)
  const meaningful = new Set([...distinctWords].filter((w) => w.length >= 3 && !STOPWORDS.has(w)))

  const variety = Math.min(meaningful.size, 12) * 2.2 // up to 26
  const length = (Math.min(idea.length, 100) / 100) * 10 // up to 10
  const repetitive = words.length >= 5 && distinctWords.size / words.length < 0.6
  const repetitionPenalty = repetitive ? 10 : 0

  const raw = getGenre(concept.genre).originalityBase - 15 + variety + length - repetitionPenalty
  return Math.max(10, Math.min(95, Math.round(raw)))
}
