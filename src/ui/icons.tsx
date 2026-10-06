import type { FeatureId } from '../engine'

// Small stroke icons, drawn on a 32x32 grid. They inherit `currentColor`, so every theme
// recolours them for free.

interface IconProps {
  className?: string
}

const base = {
  viewBox: '0 0 32 32',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

function Combat({ className }: IconProps) {
  // A shield.
  return (
    <svg {...base} className={className}>
      <path d="M16 4 L26 8 V16 C26 22 21 26 16 28 C11 26 6 22 6 16 V8 Z" />
      <path d="M16 4 V28" />
      <path d="M8 14 H24" />
    </svg>
  )
}

function Story({ className }: IconProps) {
  // An open book.
  return (
    <svg {...base} className={className}>
      <path d="M16 8 C12 6 8 6 4 7 V24 C8 23 12 23 16 25 C20 23 24 23 28 24 V7 C24 6 20 6 16 8 Z" />
      <path d="M16 8 V25" />
    </svg>
  )
}

function Crafting({ className }: IconProps) {
  // A gear.
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const x1 = 16 + Math.cos(a) * 9
    const y1 = 16 + Math.sin(a) * 9
    const x2 = 16 + Math.cos(a) * 12.5
    const y2 = 16 + Math.sin(a) * 12.5
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={3} />
  })
  return (
    <svg {...base} className={className}>
      <circle cx="16" cy="16" r="8" />
      <circle cx="16" cy="16" r="3" />
      {teeth}
    </svg>
  )
}

function Physics({ className }: IconProps) {
  // An atom.
  return (
    <svg {...base} className={className}>
      <ellipse cx="16" cy="16" rx="12" ry="5" transform="rotate(30 16 16)" />
      <ellipse cx="16" cy="16" rx="12" ry="5" transform="rotate(-30 16 16)" />
      <circle cx="16" cy="16" r="2.2" fill="currentColor" />
    </svg>
  )
}

function Vehicles({ className }: IconProps) {
  // A wheel.
  return (
    <svg {...base} className={className}>
      <circle cx="16" cy="16" r="11" />
      <circle cx="16" cy="16" r="3" />
      <path d="M16 5 V13 M16 19 V27 M5 16 H13 M19 16 H27" />
    </svg>
  )
}

function Customization({ className }: IconProps) {
  // A character with a sparkle.
  return (
    <svg {...base} className={className}>
      <circle cx="14" cy="11" r="5" />
      <path d="M4 28 C4 20 24 20 24 28" />
      <path d="M25 4 V10 M22 7 H28" />
    </svg>
  )
}

export function FeatureIcon({ id, className }: { id: FeatureId; className?: string }) {
  switch (id) {
    case 'combat':
      return <Combat className={className} />
    case 'story':
      return <Story className={className} />
    case 'crafting':
      return <Crafting className={className} />
    case 'physics':
      return <Physics className={className} />
    case 'vehicles':
      return <Vehicles className={className} />
    case 'customization':
      return <Customization className={className} />
  }
}

export function PaletteIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M16 4 C8.5 4 4 9 4 15 C4 21.5 9 27 15 27 C17.5 27 18 25.5 17 24 C16 22.5 16.8 21 18.5 21 H22 C25 21 28 19 28 15.5 C28 9 23 4 16 4 Z" />
      <circle cx="10" cy="14" r="1.6" fill="currentColor" />
      <circle cx="15" cy="9.5" r="1.6" fill="currentColor" />
      <circle cx="21.5" cy="11.5" r="1.6" fill="currentColor" />
    </svg>
  )
}

export function HelpIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="16" cy="16" r="12" />
      <path d="M12.5 12.5 C12.5 10 14.3 8.8 16 8.8 C17.9 8.8 19.5 10 19.5 12 C19.5 14.5 16 14.6 16 17.6" />
      <circle cx="16" cy="22" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 8 L24 24 M24 8 L8 24" />
    </svg>
  )
}
