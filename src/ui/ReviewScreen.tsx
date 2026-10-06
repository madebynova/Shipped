import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { TUTORIAL_PASS_SCORE } from '../engine'
import { explainRun, tutorialPassed } from '../tutorial/script'
import { formatMoney, signed, slug } from './format'
import { AnimatedNumber, prefersReducedMotion } from './motion'
import { useGameStore } from './store'

// The review is the climax of a run, so it builds up in order instead of appearing all at once.
// Stage N becomes visible at STAGE_AT[N] milliseconds. Any click or key skips to the end.
const STAGE = { score: 1, band: 2, dims: 3, verdict: 4, build: 5, turning: 6, actions: 7 } as const
const FINAL_STAGE = STAGE.actions
const STAGE_AT = [0, 300, 1500, 1900, 2700, 3500, 4300, 5100]
/** Ignore skip input right after the screen appears, so a held Enter can't skip the reveal. */
const SKIP_GRACE_MS = 450
/** After the reveal ends, wait this long before the buttons accept clicks. */
const ARM_DELAY_MS = 450

const delay = (ms: number): CSSProperties => ({ '--d': `${ms}ms` }) as CSSProperties

export default function ReviewScreen() {
  const run = useGameStore((s) => s.run)
  const turningPoint = useGameStore((s) => s.turningPoint)
  const newRun = useGameStore((s) => s.newRun)
  const editConcept = useGameStore((s) => s.editConcept)
  const openStudio = useGameStore((s) => s.openStudio)

  const [stage, setStage] = useState(() => (prefersReducedMotion() ? FINAL_STAGE : 0))
  const [skipped, setSkipped] = useState(false)
  const [armed, setArmed] = useState(false)
  const primaryRef = useRef<HTMLButtonElement>(null)

  // Build-up: reveal one stage at a time.
  useEffect(() => {
    if (prefersReducedMotion()) return
    const timers = STAGE_AT.slice(1).map((at, i) => setTimeout(() => setStage(i + 1), at))
    return () => timers.forEach(clearTimeout)
  }, [])

  // Skip: a click, Enter, Space or Esc jumps to the end of the reveal.
  useEffect(() => {
    const mountedAt = performance.now()
    const skip = () => {
      if (performance.now() - mountedAt < SKIP_GRACE_MS) return
      setSkipped(true)
      setStage(FINAL_STAGE)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') skip()
    }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // Once the reveal is over, the buttons arm shortly after, and the primary one takes focus.
  useEffect(() => {
    if (stage < FINAL_STAGE) return
    const t = setTimeout(() => setArmed(true), ARM_DELAY_MS)
    return () => clearTimeout(t)
  }, [stage])

  useEffect(() => {
    if (armed) primaryRef.current?.focus({ preventScroll: true })
  }, [armed])

  const review = run?.review
  const happened = useMemo(() => (run && run.config.kind === 'tutorial' ? explainRun(run) : []), [run])
  if (!run || !review) return null

  const tutorial = run.config.kind === 'tutorial'
  const passed = tutorial && tutorialPassed(run)
  const early = run.config.totalSprints - review.shippedSprint
  const at = (n: number) => (stage >= n ? 'in' : '')

  const dims = [
    { label: 'GAMEPLAY', value: review.gameplay },
    { label: 'CONTENT', value: review.content },
    { label: 'POLISH', value: review.polish },
    { label: 'ORIGINALITY', value: review.originality },
  ]

  return (
    <div className={`review band-${slug(review.band)} ${skipped ? 'skipped' : ''}`}>
      <div className="review-inner">
        <div className="eyebrow reveal in" style={delay(0)}>
          {tutorial ? 'MY FIRST GAME · ' : ''}REVIEW ·{' '}
          {review.forced ? 'SHIPPED AT THE DEADLINE' : `SHIPPED IN SPRINT ${review.shippedSprint}${early > 0 ? ` (${early} EARLY)` : ''}`}
        </div>
        <h1 className="review-title reveal in" style={delay(60)}>
          {run.concept.title}
        </h1>

        <div className="score-block">
          <div className={`score reveal ${at(STAGE.score)}`}>
            <span className="score-num">
              <AnimatedNumber
                value={stage >= STAGE.score ? review.score : 0}
                from={0}
                duration={1100}
                instant={skipped}
              />
            </span>
            <span className="score-of">/ 100</span>
          </div>
          <div className={`band reveal stamp ${at(STAGE.band)}`}>{review.band}</div>
        </div>

        <div className={`dims reveal ${at(STAGE.dims)}`}>
          {dims.map((d, i) => (
            <div key={d.label} className="dim">
              <span className="dim-label">{d.label}</span>
              <span className="dim-bar" aria-hidden="true">
                <i
                  style={{
                    width: stage >= STAGE.dims ? `${d.value}%` : '0%',
                    transitionDelay: skipped ? '0ms' : `${i * 140}ms`,
                  }}
                />
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
            )}{' '}
            → <b>{review.score}</b>
          </p>
        </div>

        <div className={`verdict reveal ${at(STAGE.verdict)}`}>
          {review.verdict.map((line, i) => (
            <p key={line} style={delay(i * 260)}>
              {line}
            </p>
          ))}
        </div>

        <div className={`final-state reveal ${at(STAGE.build)}`}>
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
            {run.features.filter((f) => f.state !== 'PLANNED').length} of {run.features.length} features · {run.bugs}{' '}
            {run.bugs === 1 ? 'bug' : 'bugs'} · hype {run.hype} · morale {run.morale} · {formatMoney(run.money)}
          </p>
        </div>

        {tutorial && (
          <section className={`happened reveal ${at(STAGE.build)}`} style={delay(150)} aria-label="What just happened">
            <div className="eyebrow">WHAT JUST HAPPENED</div>
            <ul>
              {happened.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </section>
        )}

        {turningPoint && (
          <section
            className={`turning ${turningPoint.kind} reveal slam ${at(STAGE.turning)}`}
            aria-label="Turning point"
          >
            <div className="eyebrow">TURNING POINT</div>
            <h2>{turningPoint.headline.replace(': ', ' — ')}</h2>
            <p>{turningPoint.explanation}</p>
          </section>
        )}

        <div className={`review-actions reveal ${at(STAGE.actions)}`}>
          {tutorial &&
            (passed ? (
              <p className="studio-note open">
                <b>Your studio is open.</b> Full game unlocked.
              </p>
            ) : (
              <p className="studio-note closed">
                <b>Not quite.</b> You need {TUTORIAL_PASS_SCORE} to pass your first game. It is meant to be doable. Give it
                another go.
              </p>
            ))}
          {tutorial && passed ? (
            <button ref={primaryRef} type="button" className="cta" disabled={!armed} onClick={openStudio}>
              OPEN THE STUDIO
              <span>start your first full run</span>
            </button>
          ) : (
            <button ref={primaryRef} type="button" className="cta" disabled={!armed} onClick={newRun}>
              {tutorial ? 'TRY AGAIN' : 'NEW RUN'}
              <span>same concept, fresh seed</span>
            </button>
          )}
          {!(tutorial && passed) && (
            <button type="button" className="ghost" disabled={!armed} onClick={editConcept}>
              Change concept
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
