import { describe, expect, it } from 'vitest'
import { hashString, nextFloat, pickOne, randomSeed } from './rng'

function sequence(seed: number, n: number): number[] {
  const out: number[] = []
  let state = seed
  for (let i = 0; i < n; i++) {
    const r = nextFloat(state)
    out.push(r.value)
    state = r.state
  }
  return out
}

describe('seeded rng', () => {
  it('produces the same sequence for the same seed', () => {
    expect(sequence(1234, 20)).toEqual(sequence(1234, 20))
  })

  it('produces different sequences for different seeds', () => {
    expect(sequence(1, 10)).not.toEqual(sequence(2, 10))
  })

  it('stays in [0, 1)', () => {
    for (const v of sequence(99, 500)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is spread across the range', () => {
    const values = sequence(7, 2000)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    expect(mean).toBeGreaterThan(0.45)
    expect(mean).toBeLessThan(0.55)
  })

  it('does not mutate anything: the input state is just a number', () => {
    const first = nextFloat(5)
    expect(nextFloat(5)).toEqual(first)
  })

  it('picks every item eventually and only items from the list', () => {
    const items = ['a', 'b', 'c'] as const
    const seen = new Set<string>()
    let state = 42
    for (let i = 0; i < 100; i++) {
      const r = pickOne(state, items)
      seen.add(r.value)
      state = r.state
    }
    expect([...seen].sort()).toEqual(['a', 'b', 'c'])
  })

  it('hashes strings consistently', () => {
    expect(hashString('Iron Pulse')).toBe(hashString('Iron Pulse'))
    expect(hashString('Iron Pulse')).not.toBe(hashString('Iron Pulse '))
  })

  it('makes usable non-zero seeds', () => {
    for (let i = 0; i < 50; i++) {
      const seed = randomSeed()
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThan(0)
    }
  })
})
