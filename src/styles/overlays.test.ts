import { describe, expect, it } from 'vitest'
import appCss from './app.css?raw'

// THE WHITE LINE BUG (found in v0.0.2, fixed in v0.0.3).
//
// The card "shine" was a ::after overlay slid off the card with `transform: translateX(-130%)`.
// Cards do not clip their children, so a pale diagonal band stayed on screen *outside* every card,
// painted over the neighbouring card's name and icon, for the whole development phase.
//
// The fix is a rule, not just a patch: a decorative pseudo-element must never be moved around with
// a percentage translate. Keep the box exactly where it is and slide a background inside it instead.
// These tests read the real stylesheet, so they fail if the mistake is ever made again.

/** Every `selector { body }` pair in the stylesheet (comments removed, @media blocks flattened). */
function rules(css: string): { selector: string; body: string }[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }))
}

const all = rules(appCss)
const pseudo = all.filter((r) => /::(before|after)/.test(r.selector))

describe('decorative overlays stay inside the element that owns them', () => {
  it('reads the real stylesheet', () => {
    expect(all.length).toBeGreaterThan(100)
    expect(pseudo.length).toBeGreaterThan(5)
  })

  it('never moves a ::before / ::after box with a percentage translate', () => {
    const offenders = pseudo
      .filter((r) => /translate[XYZ3d]*\([^)]*%/i.test(r.body) || /(^|;|\s)translate\s*:[^;]*%/i.test(r.body))
      .map((r) => r.selector)
    expect(offenders, 'a pseudo-element translated by a % can end up outside its owner (the white line bug)').toEqual([])
  })

  it('sweeps the card shine with background-position instead of transform', () => {
    const rest = all.find((r) => r.selector === '.card::after')
    const hover = all.find((r) => r.selector === '.card:hover::after')
    expect(rest, '.card::after rule').toBeDefined()
    expect(hover, '.card:hover::after rule').toBeDefined()
    expect(rest!.body).toMatch(/background-position\s*:/)
    expect(rest!.body).not.toMatch(/transform\s*:/)
    expect(hover!.body).toMatch(/background-position\s*:/)
    expect(hover!.body).not.toMatch(/transform\s*:/)
  })

  it('keeps the shine out of the way of reduced-motion players', () => {
    expect(appCss).toMatch(/prefers-reduced-motion[\s\S]*\.card::after\s*\{\s*display:\s*none/)
  })
})

// A smaller cousin of the same mistake, found while checking narrow windows: the review's verdict word ("SOLID")
// is stamped in by an animation that starts at 1.6x size. As a full-width block that growth was ~1200px wide, so for
// a moment the page scrolled sideways in any window under about 1200px. Sizing the word to its own text fixes it.
describe('the verdict stamp does not push the page sideways', () => {
  it('is sized to its own word, because the stamp animation grows it to 1.6x', () => {
    const band = all.find((r) => r.selector === '.band')
    expect(band, '.band rule').toBeDefined()
    expect(band!.body).toMatch(/width\s*:\s*fit-content/)
    expect(appCss).toMatch(/@keyframes stamp[\s\S]*scale\(1\.6\)/)
  })
})
