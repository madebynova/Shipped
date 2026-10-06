import { describe, expect, it } from 'vitest'
import indexHtml from '../index.html?raw'
import themesCss from './styles/themes.css?raw'
import { DEFAULT_THEME, THEMES, applyTheme, isThemeId, themeName } from './themes'

// --- read the real CSS so the test checks what ships ------------------------------------

type Tokens = Record<string, string>

function parseThemes(css: string): Record<string, Tokens> {
  const found: Record<string, Tokens> = {}
  const block = /([^{}]+)\{([^{}]*)\}/g
  for (const match of css.matchAll(block)) {
    const selector = match[1]
    const body = match[2]
    if (!/--bg\s*:/.test(body)) continue // atmosphere blocks have no palette
    const id = /\[data-theme='([\w-]+)'\]/.exec(selector)?.[1]
    if (!id) continue
    const tokens: Tokens = {}
    for (const decl of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[decl[1].slice(2)] = decl[2].trim()
    found[id] = tokens
  }
  return found
}

const themes = parseThemes(themesCss)

const REQUIRED = [
  'bg', 'bg-2', 'panel', 'panel-2', 'line', 'line-2',
  'text', 'text-2', 'dim', 'faint',
  'accent', 'accent-2', 'on-accent', 'ship', 'ship-2', 'on-ship',
  'green', 'red', 'blue', 'violet', 'teal', 'gold', 'orange', 'pink',
  'glow-a', 'glow-b', 'shadow', 'hl', 'scrim',
  'radius', 'font-display',
]
const SEMANTIC = ['green', 'red', 'blue', 'violet', 'teal', 'gold', 'orange', 'pink']
const SURFACES = ['bg', 'bg-2', 'panel', 'panel-2']

// --- WCAG helpers -------------------------------------------------------------------------

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function hue(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return h < 0 ? h + 360 : h
}

const hueDistance = (a: string, b: string) => {
  const d = Math.abs(hue(a) - hue(b))
  return Math.min(d, 360 - d)
}

describe('theme registry', () => {
  it('ships five curated themes with distinct names', () => {
    expect(THEMES).toHaveLength(5)
    expect(new Set(THEMES.map((t) => t.name)).size).toBe(5)
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(5)
    expect(THEMES.map((t) => t.name)).toEqual(['MIDNIGHT', 'TERMINAL', 'SUNSET', 'CLEAN PAPER', 'MISSING TEXTURE'])
  })

  it('recognises only real theme ids', () => {
    for (const t of THEMES) expect(isThemeId(t.id)).toBe(true)
    for (const bad of ['', 'nope', 'MIDNIGHT', null, undefined, 3, {}]) expect(isThemeId(bad)).toBe(false)
    expect(isThemeId(DEFAULT_THEME)).toBe(true)
    expect(themeName('paper')).toBe('CLEAN PAPER')
  })

  it('applies a theme by setting a data attribute on the root element', () => {
    const calls: Array<[string, string]> = []
    const root = { setAttribute: (k: string, v: string) => calls.push([k, v]) } as unknown as HTMLElement
    applyTheme('sunset', root)
    expect(calls).toEqual([['data-theme', 'sunset']])
  })
})

describe('themes.css', () => {
  it('defines a block for every registered theme, and no stray ones', () => {
    expect(Object.keys(themes).sort()).toEqual(THEMES.map((t) => t.id).sort())
  })

  it.each(THEMES.map((t) => t.id))('%s defines every token', (id) => {
    for (const token of REQUIRED) expect(themes[id], `${id} is missing --${token}`).toHaveProperty(token)
  })

  it('makes the default theme the :root fallback so the page is themed even with no attribute', () => {
    expect(themesCss).toMatch(new RegExp(`:root,\\s*\\[data-theme='${DEFAULT_THEME}'\\]`))
  })

  it('uses hex colours for every colour token, so contrast can be verified', () => {
    for (const [id, tokens] of Object.entries(themes)) {
      for (const token of REQUIRED.filter((t) => !['radius', 'font-display'].includes(t))) {
        expect(tokens[token], `${id} --${token}`).toMatch(/^#[0-9a-f]{3}([0-9a-f]{3})?$/i)
      }
    }
  })
})

describe.each(THEMES.map((t) => t.id))('contrast: %s', (id) => {
  const t = themes[id]

  it('primary text is very readable on every surface (AAA, 7:1)', () => {
    for (const s of SURFACES) expect(contrast(t.text, t[s]), `text on ${s}`).toBeGreaterThanOrEqual(7)
  })

  it('secondary and dim text pass AA (4.5:1) on every surface', () => {
    for (const s of SURFACES) {
      expect(contrast(t['text-2'], t[s]), `text-2 on ${s}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.dim, t[s]), `dim on ${s}`).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(t.dim, t['panel-2'])).toBeGreaterThanOrEqual(4.5)
  })

  it('faint (disabled, placeholder) text is still visible (3:1)', () => {
    for (const s of SURFACES) expect(contrast(t.faint, t[s]), `faint on ${s}`).toBeGreaterThanOrEqual(3)
  })

  it('every semantic colour is readable as text on panels (4.5:1)', () => {
    for (const color of SEMANTIC) {
      for (const s of ['bg', 'panel', 'panel-2']) {
        expect(contrast(t[color], t[s]), `${color} on ${s}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('the accent is readable on surfaces and button text is readable on the accent', () => {
    for (const s of ['bg', 'panel', 'panel-2']) expect(contrast(t.accent, t[s]), `accent on ${s}`).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['on-accent'], t.accent)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['on-accent'], t['accent-2'])).toBeGreaterThanOrEqual(4.5)
  })

  it('the SHIP button text is readable on both ends of its gradient', () => {
    expect(contrast(t['on-ship'], t.ship)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['on-ship'], t['ship-2'])).toBeGreaterThanOrEqual(4.5)
  })

  it('good and bad states are clearly different colours, not just shades', () => {
    expect(hueDistance(t.green, t.red)).toBeGreaterThanOrEqual(60)
    expect(hueDistance(t.green, t.red)).toBeLessThanOrEqual(300)
  })

  it('panels and borders are distinguishable from the page', () => {
    expect(contrast(t['line-2'], t.panel)).toBeGreaterThanOrEqual(1.25)
    expect(t.panel).not.toBe(t.bg)
  })
})

describe('first-paint theme script in index.html', () => {
  it('applies the saved theme before the app loads', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1] ?? ''
    expect(script).toContain('shipped:save')
    expect(script).toContain('data-theme')
    // it must run before the module bundle that mounts React
    expect(indexHtml.indexOf('shipped:save')).toBeLessThan(indexHtml.indexOf('type="module"'))
  })

  it('knows exactly the same theme ids as the registry (they may never drift apart)', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1] ?? ''
    const list = /var ids = \[([^\]]*)\]/.exec(script)?.[1] ?? ''
    const inHtml = [...list.matchAll(/'([\w-]+)'/g)].map((m) => m[1])
    expect(inHtml.sort()).toEqual(THEMES.map((t) => t.id).sort())
  })
})
