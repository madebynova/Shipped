import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { legacyVerdict } from '../engine'
import type { ReviewBand } from '../engine'
import { formatMoney, signed, slug, sprintsText } from './format'
import { AnimatedNumber } from './motion'
import { useGameStore } from './store'

// The legacy card is written when a game is retired, by the player or because the money ran out. It puts the two
// scores side by side: the LAUNCH score (the first impression, which never changed) and the LEGACY score.

/** Buttons wake up a moment after the card appears, so a held Enter cannot skip past it. */
const ARM_DELAY_MS = 900

const delay = (ms: number): CSSProperties => ({ '--d': `${ms}ms` }) as CSSProperties

interface ScoreCardProps {
  label: string
  value: number
  band: ReviewBand
  note: string
  stamp?: string
}

function ScoreCard({ label, value, band, note, stamp }: ScoreCardProps) {
  return (
    <div className={`duo-card band-${slug(band)}`}>
      <span className="score-cap">{label}</span>
      <b className="duo-num">
        <AnimatedNumber value={value} from={0} duration={1000} />
      </b>
      <span className="duo-band">{band}</span>
      <span className="duo-note">{note}</span>
      {stamp && <span className="stamp-complete">{stamp}</span>}
    </div>
  )
}

export default function LegacyScreen() {
  const run = useGameStore((s) => s.run)
  const newRun = useGameStore((s) => s.newRun)
  const editConcept = useGameStore((s) => s.editConcept)
  const [armed, setArmed] = useState(false)
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ARM_DELAY_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (armed) primaryRef.current?.focus({ preventScroll: true })
  }, [armed])

  const legacy = run?.legacy
  if (!run || !legacy || !run.review) return null

  const live = run.live
  const delta = legacy.score - legacy.launchScore
  const lines = legacyVerdict(run, legacy)
  const built = run.features.filter((f) => f.state !== 'PLANNED').length

  const math: [string, number][] = [
    ['Review of the game as it ended', legacy.review],
    ['Skeptical players discount the climb', -legacy.skepticism],
    ['Promises still unbuilt', -legacy.promisePenalty],
    ['Promises you cancelled', -legacy.cancelPenalty],
    ['COMPLETE bonus', legacy.completeBonus],
  ]

  return (
    <div className={`review legacy band-${slug(legacy.band)}`}>
      <div className="review-inner">
        <div className="eyebrow reveal in" style={delay(0)}>
          LEGACY CARD · {legacy.reason === 'broke' ? 'THE STUDIO RAN OUT OF MONEY' : 'RETIRED BY YOU'}
        </div>
        <h1 className="review-title reveal in" style={delay(60)}>
          {run.concept.title}
        </h1>

        <div className="duo reveal in" style={delay(160)}>
          <ScoreCard label="LAUNCH SCORE" value={legacy.launchScore} band={legacy.launchBand} note="the first impression · never changes" />
          <div className="duo-between" aria-label={`Change since launch: ${signed(delta)}`}>
            <span className="duo-arrow" aria-hidden="true">
              →
            </span>
            <b className={delta > 0 ? 'up' : delta < 0 ? 'down' : ''}>{signed(delta)}</b>
          </div>
          <ScoreCard
            label="LEGACY SCORE"
            value={legacy.score}
            band={legacy.band}
            note={live ? 'how the game ended up' : 'no updates, so it matches the launch'}
            stamp={legacy.complete ? 'COMPLETE' : undefined}
          />
        </div>

        <div className="verdict reveal in" style={delay(420)}>
          {lines.map((line, i) => (
            <p key={line} style={delay(560 + i * 220)}>
              {line}
            </p>
          ))}
        </div>

        {live && (
          <section className="happened reveal in" style={delay(900)} aria-label="How the legacy score adds up">
            <div className="eyebrow">HOW THE LEGACY SCORE ADDS UP</div>
            <ul className="math-list">
              {math
                .filter(([, n], i) => i === 0 || n !== 0)
                .map(([label, n], i) => (
                  <li key={label}>
                    <span>{label}</span>
                    <b className={i > 0 ? (n > 0 ? 'up' : 'down') : ''}>{i === 0 ? n : signed(n)}</b>
                  </li>
                ))}
              <li className="math-result">
                <span>Legacy score</span>
                <b>{legacy.score}</b>
              </li>
            </ul>
          </section>
        )}

        {live && live.releases.length > 0 && (
          <section className="patch-history reveal in" style={delay(1000)} aria-label="Patch notes">
            <div className="eyebrow">PATCH NOTES</div>
            <ul>
              {live.releases.map((release) => (
                <li key={release.version}>
                  <b className="patch-version">{release.version}</b>
                  <span className="patch-summary">{release.summary}</span>
                  <span className="patch-legacy">
                    {release.legacyBefore} → {release.legacyAfter}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="final-state reveal in" style={delay(1100)}>
          <div className="eyebrow">THE GAME YOU LEAVE BEHIND</div>
          <ul className="shipped-features">
            {run.features.map((f) => (
              <li key={f.id} className={`sf sf-${f.state.toLowerCase()}`}>
                <span>{f.name}</span>
                <em>
                  {live?.cancelled.includes(f.id) ? 'cancelled' : f.state === 'PLANNED' ? 'not built' : `${f.state.toLowerCase()} · ${f.quality}`}
                </em>
              </li>
            ))}
          </ul>
          <p className="shipped-stats">
            {built} of {run.features.length} features · {run.bugs} {run.bugs === 1 ? 'bug' : 'bugs'} · {sprintsText(legacy.liveSprints)}{' '}
            live · {legacy.releases} {legacy.releases === 1 ? 'release' : 'releases'} · {formatMoney(legacy.totalSales)} in lifetime sales ·{' '}
            {formatMoney(Math.max(0, run.money))} left in the account
          </p>
        </div>

        <div className="review-actions reveal in" style={delay(1200)}>
          <button ref={primaryRef} type="button" className="cta" disabled={!armed} onClick={newRun}>
            NEW RUN
            <span>same concept, fresh seed</span>
          </button>
          <button type="button" className="ghost" disabled={!armed} onClick={editConcept}>
            Change concept
          </button>
        </div>
      </div>
    </div>
  )
}
