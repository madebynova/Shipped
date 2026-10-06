import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { moraleTier, stability } from '../engine'
import type { ReviewBand } from '../engine'
import { buzzStatus, formatMoney, hypeStatus, liveMoneyStatus, moneyStatus, moraleMood, signed, stabilityMood } from './format'
import type { Mood } from './format'
import { HELP } from './help'
import { AnimatedNumber, glow, shake, useOnChange } from './motion'
import { TipBubble } from './Tooltip'

type Kind = 'money' | 'morale' | 'hype' | 'bugs' | 'legacy'

const GLOW: Record<Kind, string> = {
  money: 'var(--green)',
  morale: 'var(--blue)',
  hype: 'var(--violet)',
  bugs: 'var(--red)',
  legacy: 'var(--gold)',
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

/** After launch the MONEY tile becomes the revenue account. */
export interface LiveMoney {
  /** What sales will bring in when this sprint closes. */
  income: number
  /** How many more sprints the account can pay for if nothing new happens. */
  runway: number
}

/** After launch a fifth tile shows the LEGACY score next to the permanent LAUNCH score. */
export interface LegacyTile {
  score: number
  band: ReviewBand
  launch: number
  /** The arithmetic, shown on hover. */
  tip: ReactNode
}

const BAND_MOOD: Record<ReviewBand, Mood> = {
  MASTERPIECE: 'good',
  GREAT: 'good',
  SOLID: 'neutral',
  ROUGH: 'warn',
  DISASTER: 'bad',
  'LEGENDARY FAILURE': 'bad',
}

interface Props {
  /** What closing a sprint costs right now; it grows with scope. */
  upkeep: number
  /** Set for a live game: the LEGACY tile. */
  legacy?: LegacyTile
  /** Sprint-closes left before the game ships. */
  sprintsLeft: number
  /** Set for a live (post-launch) game. */
  live?: LiveMoney
  money: number
  morale: number
  hype: number
  bugs: number
}

/** The four visible resources. Compact, readable, no giant meters. Hover any for a one-liner. */
export default function ResourceBar({ upkeep, sprintsLeft, live, legacy, money, morale, hype, bugs }: Props) {
  const tier = moraleTier(morale)
  const stable = stability(bugs)
  return (
    <section className={`resources ${legacy ? 'has-legacy' : ''}`} aria-label="Resources">
      <Tile
        kind="money"
        label={live ? 'REVENUE' : 'MONEY'}
        value={money}
        format={formatMoney}
        status={live ? liveMoneyStatus(money, live.runway) : moneyStatus(money, upkeep, sprintsLeft)}
        risingIsGood
        tip={live ? HELP.revenue(live.income, upkeep) : HELP.money(upkeep)}
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
        status={live ? buzzStatus(hype) : hypeStatus(hype)}
        risingIsGood={null}
        gauge={hype}
        tip={live ? HELP.buzz : HELP.hype}
      />
      <Tile
        kind="bugs"
        label="BUGS"
        value={bugs}
        status={{ label: stable, mood: stabilityMood(stable) }}
        risingIsGood={false}
        tip={HELP.bugs}
        tipAlign={legacy ? 'start' : 'end'}
      />
      {legacy && (
        <Tile
          kind="legacy"
          label="LEGACY"
          value={legacy.score}
          status={{ label: `LAUNCH ${legacy.launch} · ${legacy.band}`, mood: BAND_MOOD[legacy.band] }}
          risingIsGood
          tip={legacy.tip}
          tipAlign="end"
        />
      )}
    </section>
  )
}
