import { describe, expect, it } from 'vitest'

// React treats whatever a useEffect callback returns as its cleanup function.
// `useEffect(() => doSomething(), [])` returns doSomething()'s result, and if that
// is not undefined, the production build crashes with "x is not a function" while the
// dev build only logs a warning. Effects must be written as blocks that return nothing
// (or a cleanup function). These tests cannot render React, so we guard the source.

const sources = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('React effects', () => {
  it('reads the source files it is meant to guard', () => {
    const files = Object.keys(sources)
    expect(files.some((f) => f.endsWith('/src/App.tsx'))).toBe(true)
    expect(files.some((f) => f.endsWith('/src/ui/GameScreen.tsx'))).toBe(true)
  })

  it('never use an expression-bodied arrow function as a useEffect callback', () => {
    const offenders: string[] = []
    for (const [file, text] of Object.entries(sources)) {
      if (file.endsWith('.test.ts')) continue
      text.split('\n').forEach((line, i) => {
        if (/use(Layout)?Effect\(\s*\(\)\s*=>\s*[^{\s]/.test(line)) offenders.push(`${file}:${i + 1}`)
      })
    }
    expect(offenders).toEqual([])
  })
})
