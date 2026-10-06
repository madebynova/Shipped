import { useId } from 'react'
import type { ReactNode } from 'react'

type Align = 'start' | 'center' | 'end'
type Placement = 'bottom' | 'top'

interface BubbleProps {
  id: string
  text: ReactNode
  align?: Align
  placement?: Placement
}

/**
 * The bubble itself. Put it inside any element that has the `has-tip` class (and a tabIndex
 * if it should be readable by keyboard) and give that element aria-describedby={id}.
 */
export function TipBubble({ id, text, align = 'start', placement = 'bottom' }: BubbleProps) {
  return (
    <span id={id} role="tooltip" className={`tip tip-${placement} tip-${align}`}>
      {text}
    </span>
  )
}

interface Props {
  /** The friendly explanation. */
  text: ReactNode
  children: ReactNode
  /** Which edge of the wrapped element the bubble lines up with. */
  align?: Align
  placement?: Placement
  className?: string
  /** Make the wrapper keyboard-focusable so the tip can be read without a mouse. */
  focusable?: boolean
  as?: 'div' | 'span'
}

/**
 * A passive, accessible tooltip: shows on hover (after a short delay) and on keyboard focus,
 * never asks the player to do anything. Pure CSS positioning; see `.has-tip` in styles.css.
 */
export default function Tooltip({
  text,
  children,
  align = 'start',
  placement = 'bottom',
  className = '',
  focusable = true,
  as = 'span',
}: Props) {
  const id = useId()
  const Tag = as
  return (
    <Tag
      className={`has-tip ${className}`.trim()}
      tabIndex={focusable ? 0 : undefined}
      aria-describedby={id}
    >
      {children}
      <TipBubble id={id} text={text} align={align} placement={placement} />
    </Tag>
  )
}
