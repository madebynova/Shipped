import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { moraleTier, stability } from '../engine'
import { formatMoney, hypeStatus, moneyStatus, moraleMood, signed, stabilityMood } from './format'
import type { Mood } from './format'
import { HELP } from './help'
import { AnimatedNumber, glow, shake, useOnChange } from './motion'
import { TipBubble } from './Tooltip'

type Kind = 'money' | 'morale' | 'hype' | 'bugs'

const GLOW: Record<Kind, string> = {
  money: 'var(--green)',
  morale: 'var(--blue)',
  hype: 'var(--violet)',
  bugs: 'var(--red)',
}

interface TileProps {
  kind: Kind
  label: string
  value: number
  status: { label: string; mood: Mood }
  /** Whether a rising value is good news (colours the delta chip). */
  risingIsGood: boolean | null
  format?: (n: number) => string
  /** 0-100: draws a hairline underline. */
  gauge?: number
  /** The friendly one-or-two sentence explanation shown on hover / focus. */
  tip: ReactNode
  tipAlign?: 'start' | 'end'
}

function Tile({ kind, label, value, status, risingIsGood, format, gauge, tip, tipAlign = 'start' }: TileProps) {
  const ref = useRef<HTMLDivElement>(null)
  const tipId = useId()
  const [delta, setDelta] = useState<{ n: number; id: number } | null>(null)
  const counter = useRef(0)

  useOnChange(value, (next, prev) => {
    const n = next - prev
    setDelta({ n, id: ++counter.current })
    glow(ref.current, GLOW[kind], 8)
    if (kind === 'bugs' && n > 0) shake(ref.current)
  })

  useEffect(() => {
    if (!delta) return
    const t = setTimeout(() => setDelta(null), 1500)
    return () => clearTimeout(t)
  }, [delta])

  const tone =
    delta === null || risingIsGood === null
      ? 'neutral'
      : (delta.n > 0) === risingIsGood
        ? 'good'
        : 'bad'

  return (
    <div
      ref={ref}
      className={`tile tile-${kind} mood-${status.mood} has-tip`}
      tabIndex={0}
      aria-describedby={tipId}
    >
      <div className="tile-label">{label}</div>
      <div className="tile-value">
        <AnimatedNumber value={value} format={format} />
        {delta && (
          <span key={delta.id} className={`delta delta-${tone}`} aria-hidden="true">
            {signed(delta.n)}
          </span>
        )}
      </div>
      <div className="tile-status">{status.label}</div>
      {gauge !== undefined && (
        <div className="tile-gauge" aria-hidden="true">
          <i style={{ width: `${Math.max(0, Math.min(100, gauge))}%` }} />
        </div>
      )}
      <TipBubble id={tipId} text={tip} align={tipAlign} />
    </div>
  )
}

interface Props {
  /** What closing a sprint costs right now; it grows with scope. */
  upkeep: number
  /** Sprint-closes left before the game ships. */
  sprintsLeft: number
  money: number
  morale: number
  hype: number
  bugs: number
}

/** The four visible resources. Compact, readable, no giant meters. Hover any for a one-liner. */
export default function ResourceBar({ upkeep, sprintsLeft, money, morale, hype, bugs }: Props) {
  const tier = moraleTier(morale)
  const stable = stability(bugs)
  return (
    <section className="resources" aria-label="Resources">
      <Tile
        kind="money"
        label="MONEY"
        value={money}
        format={formatMoney}
        status={moneyStatus(money, upkeep, sprintsLeft)}
        risingIsGood
        tip={HELP.money(upkeep)}
      />
      <Tile
        kind="morale"
        label="MORALE"
        value={morale}
        status={{ label: tier, mood: moraleMood(tier) }}
        risingIsGood
        gauge={morale}
        tip={HELP.morale}
      />
      <Tile
        kind="hype"
        label="HYPE"
        value={hype}
        status={hypeStatus(hype)}
        risingIsGood={null}
        gauge={hype}
        tip={HELP.hype}
      />
      <Tile
        kind="bugs"
        label="BUGS"
        value={bugs}
        status={{ label: stable, mood: stabilityMood(stable) }}
        risingIsGood={false}
        tip={HELP.bugs}
        tipAlign="end"
      />
    </section>
  )
}
