// A tiny seeded RNG (mulberry32) written as pure functions: you pass the state in
// and get the next state back. The same seed always replays the same run.
//
// In v0.0.1 randomness only picks flavour text. Scores and resource changes never
// depend on it, which is what keeps reviews deterministic.

export interface Rolled<T> {
  value: T
  state: number
}

/** Turn any string into a 32-bit seed (FNV-1a). */
export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Next float in [0, 1). */
export function nextFloat(state: number): Rolled<number> {
  const t = (state + 0x6d2b79f5) >>> 0
  let r = Math.imul(t ^ (t >>> 15), 1 | t)
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
  return { value: ((r ^ (r >>> 14)) >>> 0) / 4294967296, state: t }
}

/** Pick one item from a non-empty list. */
export function pickOne<T>(state: number, items: readonly T[]): Rolled<T> {
  const { value, state: next } = nextFloat(state)
  return { value: items[Math.floor(value * items.length)], state: next }
}

/** A fresh seed. This is the one impure helper; call it from the UI layer only. */
export function randomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1
}
