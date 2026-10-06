import { useEffect, useRef, useState } from 'react'

// Small motion helpers. Everything respects "reduce motion".

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Turn "var(--green)" into the colour it currently resolves to, so glows follow the active theme. */
function resolveColor(el: HTMLElement, color: string): string {
  const match = /^var\((--[\w-]+)\)$/.exec(color)
  if (!match) return color
  return getComputedStyle(el).getPropertyValue(match[1]).trim() || 'currentColor'
}

/** Briefly glow an element's outline. `color` is any CSS colour or a theme variable like "var(--green)". */
export function glow(el: HTMLElement | null, color: string, spread = 10, ms = 700): void {
  if (!el || prefersReducedMotion() || !el.animate) return
  const c = resolveColor(el, color)
  el.animate(
    [
      { boxShadow: `0 0 0 0 color-mix(in srgb, ${c} 65%, transparent)` },
      { boxShadow: `0 0 0 ${spread}px color-mix(in srgb, ${c} 0%, transparent)` },
    ],
    { duration: ms, easing: 'ease-out' },
  )
}

/** A small horizontal shake: used when bugs appear. */
export function shake(el: HTMLElement | null): void {
  if (!el || prefersReducedMotion() || !el.animate) return
  el.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(-3px)' },
      { transform: 'translateX(2px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 380, easing: 'ease-out' },
  )
}

/** Run an effect whenever `value` changes, but not on first mount. */
export function useOnChange<T>(value: T, onChange: (next: T, prev: T) => void): void {
  const prev = useRef(value)
  const callback = useRef(onChange)
  callback.current = onChange
  useEffect(() => {
    if (Object.is(prev.current, value)) return
    const before = prev.current
    prev.current = value
    callback.current(value, before)
  }, [value])
}

interface AnimatedNumberProps {
  value: number
  /** Start counting from here on mount (default: no initial tween). */
  from?: number
  duration?: number
  format?: (n: number) => string
  /** Jump straight to the value (used when the player skips an animation). */
  instant?: boolean
}

/** A number that eases to its new value instead of snapping. */
export function AnimatedNumber({ value, from, duration = 380, format, instant = false }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(from ?? value)
  const shown = useRef(from ?? value)

  useEffect(() => {
    const start = shown.current
    if (start === value) return
    if (instant || prefersReducedMotion()) {
      shown.current = value
      setDisplay(value)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      shown.current = start + (value - start) * eased
      setDisplay(shown.current)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, instant])

  const rounded = Math.round(display)
  return <>{format ? format(rounded) : rounded}</>
}
