import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { TOTAL_SPRINTS } from '../engine'
import { formatMoney, signed, slug } from './format'
import { AnimatedNumber } from './motion'
import { useGameStore } from './store'

export default function ReviewScreen() {
  const run = useGameStore((s) => s.run)
  const turningPoint = useGameStore((s) => s.turningPoint)
  const newRun = useGameStore((s) => s.newRun)
  const editConcept = useGameStore((s) => s.editConcept)

  // The reveal plays for a moment; NEW RUN stays inert just long enough that a
  // stray double-click on SHIP can't skip the review.
  const [filled, setFilled] = useState(false)
  const [armed, setArmed] = useState(false)
  const newRunRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const a = setTimeout(() => setFilled(true), 250)
    const b = setTimeout(() => setArmed(true), 800)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])

  // A disabled button can't hold focus, so hand it over the moment NEW RUN arms:
  // from then on a single Enter starts the next run.
  useEffect(() => {
    if (armed) newRunRef.current?.focus({ preventScroll: true })
  }, [armed])

  const review = run?.review
  if (!run || !review) return null

  const dims = [
    { label: 'GAMEPLAY', value: review.gameplay },
    { label: 'CONTENT', value: review.content },
    { label: 'POLISH', value: review.polish },
    { label: 'ORIGINALITY', value: review.originality },
  ]
  const built = run.features.filter((f) => f.state !== 'PLANNED')
  const early = TOTAL_SPRINTS - review.shippedSprint

  return (
    <div className={`review band-${slug(review.band)}`}>
      <div className="review-inner">
        <div className="eyebrow reveal" style={{ '--d': '0ms' } as CSSProperties}>
          REVIEW · {review.forced ? 'SHIPPED AT THE DEADLINE' : `SHIPPED IN SPRINT ${review.shippedSprint}${early > 0 ? ` (${early} EARLY)` : ''}`}
        </div>
        <h1 className="review-title reveal" style={{ '--d': '60ms' } as CSSProperties}>
          {run.concept.title}
        </h1>

        <div className="score-block reveal" style={{ '--d': '160ms' } as CSSProperties}>
          <div className="score">
            <span className="score-num">
              <AnimatedNumber value={review.score} from={0} duration={1100} />
            </span>
            <span className="score-of">/ 100</span>
          </div>
          <div className="band">{review.band}</div>
        </div>

        <div className="dims reveal" style={{ '--d': '420ms' } as CSSProperties}>
          {dims.map((d) => (
            <div key={d.label} className="dim">
              <span className="dim-label">{d.label}</span>
              <span className="dim-bar" aria-hidden="true">
                <i style={{ width: filled ? `${d.value}%` : '0%' }} />
              </span>
              <b className="dim-value">{d.value}</b>
            </div>
          ))}
          <p className="dim-math">
            Average <b>{review.baseScore}</b>
            {review.hypeModifier !== 0 && (
              <>
                {' '}
                · Hype {run.hype} set the bar at {review.hypeBar}:{' '}
                <b className={review.hypeModifier > 0 ? 'up' : 'down'}>{signed(review.hypeModifier)}</b>
              </>
            )}
            {' '}
            → <b>{review.score}</b>
          </p>
        </div>

        <div className="verdict reveal" style={{ '--d': '620ms' } as CSSProperties}>
          {review.verdict.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        {turningPoint && (
          <section
            className={`turning ${turningPoint.kind} reveal`}
            style={{ '--d': '820ms' } as CSSProperties}
            aria-label="Turning point"
          >
            <div className="eyebrow">TURNING POINT</div>
            <h2>{turningPoint.headline.replace(': ', ' — ')}</h2>
            <p>{turningPoint.explanation}</p>
          </section>
        )}

        <div className="final-state reveal" style={{ '--d': '980ms' } as CSSProperties}>
          <div className="eyebrow">THE BUILD YOU SHIPPED</div>
          <ul className="shipped-features">
            {run.features.map((f) => (
              <li key={f.id} className={`sf sf-${f.state.toLowerCase()}`}>
                <span>{f.name}</span>
                <em>{f.state === 'PLANNED' ? 'not built' : `${f.state.toLowerCase()} · ${f.quality}`}</em>
              </li>
            ))}
          </ul>
          <p className="shipped-stats">
            {built.length} of {run.features.length} features · {run.bugs} {run.bugs === 1 ? 'bug' : 'bugs'} · hype {run.hype} · morale{' '}
            {run.morale} · {formatMoney(run.money)}
          </p>
        </div>

        <div className="review-actions reveal" style={{ '--d': '1100ms' } as CSSProperties}>
          <button ref={newRunRef} type="button" className="cta" disabled={!armed} onClick={newRun}>
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
