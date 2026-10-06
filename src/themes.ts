// Theme metadata only. The actual colours live in styles/themes.css as CSS variables
// under [data-theme='<id>'], so switching themes is a pure variable swap.
//
// index.html contains a tiny inline script that applies the saved theme before first paint;
// it carries a copy of these ids, and themes.test.ts fails if the two ever drift apart.

export const THEMES = [
  { id: 'midnight', name: 'MIDNIGHT', blurb: 'Deep blue-black with cool, icy accents.' },
  { id: 'terminal', name: 'TERMINAL', blurb: 'Phosphor green on black. Everything is a console.' },
  { id: 'sunset', name: 'SUNSET', blurb: 'Warm plum nights with orange and pink light.' },
  { id: 'paper', name: 'CLEAN PAPER', blurb: 'Bright, high-contrast paper and ink.' },
  { id: 'missing-texture', name: 'MISSING TEXTURE', blurb: 'The magenta checkerboard every game dev knows.' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: ThemeId = 'midnight'

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((t) => t.id === value)
}

export function themeName(id: ThemeId): string {
  return THEMES.find((t) => t.id === id)?.name ?? id
}

/** Put a theme on the page. Safe to call repeatedly; used for hover previews too. */
export function applyTheme(id: ThemeId, root: HTMLElement = document.documentElement): void {
  root.setAttribute('data-theme', id)
}
