import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { THEMES, applyTheme } from '../themes'
import type { ThemeId } from '../themes'
import { GLOSSARY } from './help'
import { HelpIcon, PaletteIcon } from './icons'
import Modal from './Modal'
import { useGameStore } from './store'
import Tooltip from './Tooltip'

function ThemePicker({ onClose }: { onClose: () => void }) {
  const current = useGameStore((s) => s.save.theme)
  const setTheme = useGameStore((s) => s.setTheme)
  const root = useRef<HTMLDivElement>(null)

  // Hovering or focusing a theme previews it live; leaving puts the real one back.
  const restore = () => applyTheme(current)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    root.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      applyTheme(useGameStore.getState().save.theme) // never leave a preview behind
    }
  }, [onClose])

  const move = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(root.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div ref={root} className="popover theme-picker" role="radiogroup" aria-label="Theme" onKeyDown={move} onMouseLeave={restore}>
      <div className="eyebrow popover-title">THEME</div>
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={current === t.id}
          className={`theme-option ${current === t.id ? 'selected' : ''}`}
          onMouseEnter={() => applyTheme(t.id)}
          onFocus={() => applyTheme(t.id)}
          onBlur={restore}
          onClick={() => {
            setTheme(t.id as ThemeId)
            onClose()
          }}
        >
          <span className="swatch" data-theme={t.id} aria-hidden="true">
            <i style={{ background: 'var(--bg)' }} />
            <i style={{ background: 'var(--panel-2)' }} />
            <i style={{ background: 'var(--accent)' }} />
            <i style={{ background: 'var(--green)' }} />
            <i style={{ background: 'var(--red)' }} />
          </span>
          <span className="theme-text">
            <span className="theme-name">{t.name}</span>
            <span className="theme-blurb">{t.blurb}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

function Glossary({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Studio glossary" onClose={onClose} className="glossary">
      <p className="modal-lede">Quick answers. Hover any number in the game for a one-liner.</p>
      <div className="glossary-body">
        {GLOSSARY.map((group) => (
          <section key={group.title} className="glossary-group">
            <h3 className="eyebrow">{group.title}</h3>
            <dl>
              {group.entries.map((entry) => (
                <div key={entry.term} className="glossary-entry">
                  <dt>{entry.term}</dt>
                  <dd>{entry.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  )
}

/** Help (?) and theme (palette) buttons: the two small controls in the corner. */
export default function Toolbar({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState<'theme' | 'help' | null>(null)
  const close = useCallback(() => setOpen(null), [])

  return (
    <div className={`toolbar ${className}`.trim()}>
      <Tooltip text="Help and glossary" align="end" focusable={false}>
        <button
          type="button"
          className="icon-btn"
          aria-label="Help and glossary"
          aria-haspopup="dialog"
          onClick={() => setOpen('help')}
        >
          <HelpIcon />
        </button>
      </Tooltip>
      <div className="theme-wrap">
        <Tooltip text="Change theme" align="end" focusable={false}>
          <button
            type="button"
            className="icon-btn"
            aria-label="Change theme"
            aria-haspopup="true"
            aria-expanded={open === 'theme'}
            onClick={() => setOpen(open === 'theme' ? null : 'theme')}
          >
            <PaletteIcon />
          </button>
        </Tooltip>
        {open === 'theme' && <ThemePicker onClose={close} />}
      </div>
      {open === 'help' && <Glossary onClose={close} />}
    </div>
  )
}
