import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import appCss from './app.css?raw'
import fontsCss from './fonts.css?raw'
import themesCss from './themes.css?raw'

// The display font used to be a pixel font (Pixelify Sans) whose C, O and D were almost the same
// shape, so "Crafting" read as "Drafting". These tests keep the fonts honest: the display font is a
// real, bundled, legible font, every file exists, and nothing is ever downloaded at runtime.

/** The woff2 files that really exist in src/assets/fonts (the keys are all we need). */
const fontFiles = Object.keys(import.meta.glob('../assets/fonts/*.woff2')).map((p) => p.split('/').pop()!)

/** Font families declared with @font-face. */
const bundled = [...fontsCss.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1])

/** The first family listed in each theme's --font-display token. */
function displayFonts(): Record<string, string> {
  const found: Record<string, string> = {}
  for (const match of themesCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const id = /\[data-theme='([\w-]+)'\]/.exec(match[1])?.[1]
    const value = /--font-display:\s*'([^']+)'/.exec(match[2])?.[1]
    if (id && value) found[id] = value
  }
  return found
}

describe('bundled fonts', () => {
  it('bundles Space Grotesk, Inter and JetBrains Mono and nothing else', () => {
    expect([...bundled].sort()).toEqual(['Inter', 'JetBrains Mono', 'Space Grotesk'])
  })

  it('no longer ships the illegible pixel font anywhere', () => {
    expect(fontsCss).not.toMatch(/pixelify/i)
    expect(themesCss).not.toMatch(/pixelify/i)
    expect(appCss).not.toMatch(/pixelify/i)
    expect(fontFiles.some((f) => /pixelify/i.test(f))).toBe(false)
  })

  it('has a font file on disk for every @font-face url()', () => {
    const urls = [...fontsCss.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1])
    expect(urls.length).toBe(bundled.length)
    for (const url of urls) {
      const file = url.split('/').pop()!
      expect(fontFiles, `${file} is referenced by fonts.css but is not in src/assets/fonts`).toContain(file)
    }
  })

  it('credits every bundled font in LICENSES.txt', async () => {
    const licenses = (await import('../assets/fonts/LICENSES.txt?raw')).default
    for (const family of bundled) expect(licenses, family).toContain(family)
  })

  it('shows every font at the weights the game uses (display headings are bold)', () => {
    expect(fontsCss).toMatch(/Space Grotesk[\s\S]*?font-weight:\s*300 700/)
  })
})

describe('the display font of every theme', () => {
  const fonts = displayFonts()

  it('is defined for all five themes', () => {
    expect(Object.keys(fonts).sort()).toEqual(['midnight', 'missing-texture', 'paper', 'sunset', 'terminal'])
  })

  it('is always a bundled font, so what the player sees is what was tested', () => {
    for (const [theme, family] of Object.entries(fonts)) {
      expect(bundled, `${theme} display font "${family}"`).toContain(family)
    }
  })

  it('is Space Grotesk wherever the old pixel font used to be', () => {
    expect(fonts.midnight).toBe('Space Grotesk')
    expect(fonts.sunset).toBe('Space Grotesk')
    expect(fonts['missing-texture']).toBe('Space Grotesk')
  })
})

describe('no runtime requests', () => {
  it('uses no remote url() in any stylesheet', () => {
    for (const [name, css] of Object.entries({ fontsCss, appCss, themesCss })) {
      expect(css, name).not.toMatch(/url\(\s*['"]?(https?:)?\/\//i)
      expect(css, name).not.toMatch(/@import/i)
    }
  })

  it('loads nothing remote from index.html (no CDN fonts, scripts or styles)', () => {
    expect(indexHtml).not.toMatch(/(src|href)=["']\s*(https?:)?\/\//i)
    expect(indexHtml).not.toMatch(/fonts\.(googleapis|gstatic)\.com/i)
  })
})
