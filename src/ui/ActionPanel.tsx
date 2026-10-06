import { useEffect, useRef } from 'react'
import {
  SLOTS_PER_SPRINT,
  TOTAL_SPRINTS,
  previewAction,
  sprintEndEffects,
  validateAction,
} from '../engine'
import type { Action, ActionType, HistoryEvent, RunState } from '../engine'
import { formatMoney, signed } from './format'
import { targetsFor } from './targets'

interface ActionDef {
  type: ActionType
  key: string
  blurb: string
}

const ACTIONS: readonly ActionDef[] = [
  { type: 'BUILD', key: 'B', blurb: 'Advance a feature. Adds bugs and scope.' },
  { type: 'POLISH', key: 'P', blurb: 'Raise a feature’s quality. Cleans a bug.' },
  { type: 'FIX', key: 'F', blurb: 'Remove bugs. Builds nothing.' },
  { type: 'HYPE', key: 'H', blurb: 'Raise hype. Improves nothing.' },
  { type: 'REST', key: 'R', blurb: 'Recover morale. Builds nothing.' },
]

type ChipTone = 'good' | 'bad' | 'warn' | 'hype'
interface Chip {
  text: string
  tone: ChipTone
}

/** The target used to show typical numbers on the BUILD / POLISH buttons. */
function sampleTarget(run: RunState, type: ActionType): Action | null {
  const eligible = targetsFor(run, type)
  if (eligible.length === 0) return null
  if (type === 'BUILD') {
    const planned = eligible.filter((f) => f.state === 'PLANNED')
    const pool = planned.length > 0 ? planned : eligible
    const best = [...pool].sort((a, b) => b.complexity - a.complexity)[0]
    return { type, featureId: best.id }
  }
  const weakest = [...eligible].sort((a, b) => a.quality - b.quality)[0]
  return { type, featureId: weakest.id }
}

function chipsFor(run: RunState, type: ActionType): Chip[] {
  const action = type === 'BUILD' || type === 'POLISH' ? sampleTarget(run, type) : { type }
  if (!action) return []
  const p = previewAction(run, action)
  if (!p.ok) return []
  const chips: Chip[] = []
  const { bugs, morale, hype } = p.deltas

  if (type === 'BUILD' && p.feature) {
    const { before, after } = p.feature
    chips.push(
      before.state === 'PLANNED'
        ? { text: `+${Math.max(0, after.progress - before.progress)} progress`, tone: 'good' }
        : { text: `+${after.quality - before.quality} quality`, tone: 'good' },
    )
  }
  if (type === 'POLISH' && p.feature) {
    chips.push({ text: `+${p.feature.after.quality - p.feature.before.quality} quality`, tone: 'good' })
  }
  if (hype !== 0) chips.push({ text: `${signed(hype)} hype`, tone: 'hype' })
  if (bugs !== 0) chips.push({ text: `${signed(bugs)} ${Math.abs(bugs) === 1 ? 'bug' : 'bugs'}`, tone: bugs > 0 ? 'bad' : 'good' })
  if (morale !== 0) chips.push({ text: `${signed(morale)} morale`, tone: morale > 0 ? 'good' : 'warn' })
  if (type === 'BUILD' && p.scopeAfter !== p.scopeBefore) {
    chips.push({ text: `scope ${p.scopeAfter}`, tone: 'warn' })
  }
  return chips
}

function whyDisabled(run: RunState, type: ActionType): string | null {
  if (type === 'BUILD' || type === 'POLISH') {
    if (targetsFor(run, type).length > 0) return null
    return type === 'POLISH' ? 'Nothing playable to polish yet.' : 'Nothing left to build.'
  }
  return validateAction(run, { type })
}

interface SlotsProps {
  run: RunState
}

/** The three action slots for this sprint, filled in as the player spends them. */
function Slots({ run }: SlotsProps) {
  const spent = run.history.filter(
    (e): e is Extract<HistoryEvent, { kind: 'action' }> => e.kind === 'action' && e.sprint === run.sprint,
  )
  return (
    <ol className="slots" aria-label="Action slots">
      {Array.from({ length: SLOTS_PER_SPRINT }, (_, i) => {
        const used = spent[i]
        return (
          <li key={i} className={`slot ${used ? 'used' : i === spent.length ? 'next' : ''}`}>
            <span className="slot-n">{i + 1}</span>
            <span className="slot-text">
              <span className="slot-type">{used ? used.action.type : 'OPEN'}</span>
              {used?.action.featureId && (
                <span className="slot-target">
                  {run.features.find((f) => f.id === used.action.featureId)?.name}
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

interface Props {
  run: RunState
  pending: ActionType | null
  onChoose: (type: ActionType) => void
  onCloseSprint: () => void
}

export default function ActionPanel({ run, pending, onChoose, onCloseSprint }: Props) {
  const fx = sprintEndEffects(run)
  const finalSprint = run.sprint >= TOTAL_SPRINTS
  const done = run.actionsLeft === 0
  const closeRef = useRef<HTMLButtonElement>(null)

  // When the last slot is spent, put the next step under the player's thumb.
  useEffect(() => {
    if (done) closeRef.current?.focus({ preventScroll: true })
  }, [done])

  return (
    <section className="panel actions" aria-label="Sprint actions">
      <header className="panel-head">
        <div className="eyebrow">THIS SPRINT</div>
        <div className="slots-left">
          <b>{run.actionsLeft}</b> of {SLOTS_PER_SPRINT} slots left
        </div>
      </header>

      <Slots run={run} />

      {!done ? (
        <>
          <div className="action-list">
            {ACTIONS.map((a) => {
              const blocked = whyDisabled(run, a.type)
              const chips = blocked ? [] : chipsFor(run, a.type)
              return (
                <button
                  key={a.type}
                  type="button"
                  className={`action action-${a.type.toLowerCase()} ${pending === a.type ? 'armed' : ''}`}
                  disabled={blocked !== null}
                  aria-pressed={pending === a.type}
                  aria-keyshortcuts={a.key}
                  onClick={() => onChoose(a.type)}
                >
                  <kbd>{a.key}</kbd>
                  <span className="action-body">
                    <span className="action-top">
                      <span className="action-name">{a.type}</span>
                      {chips.length > 0 && (
                        <span className="chips">
                          {chips.map((c) => (
                            <span key={c.text} className={`chip chip-${c.tone}`}>
                              {c.text}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="action-desc">{blocked ?? a.blurb}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <p className="end-hint">
            <span className="eyebrow">WHEN THE SPRINT ENDS</span>
            {finalSprint ? (
              <span>The deadline hits. The game ships.</span>
            ) : (
              <span>
                Burn {formatMoney(Math.abs(fx.money))}
                {fx.bugs > 0 ? `, ${signed(fx.bugs)} ${fx.bugs === 1 ? 'bug creeps' : 'bugs creep'} in` : ''}
                {fx.morale < 0 ? `, ${signed(fx.morale)} morale` : ''}
              </span>
            )}
          </p>
        </>
      ) : (
        <div className="closing">
          <div className="eyebrow">{finalSprint ? 'DEADLINE' : `SPRINT ${run.sprint} COMPLETE`}</div>
          {finalSprint ? (
            <p>All three slots are spent. Time is up: your game ships exactly as it stands.</p>
          ) : (
            <ul className="end-notes">
              {fx.notes.map((n) => (
                <li key={n.text} className={`tone-${n.tone}`}>
                  {n.text}
                </li>
              ))}
            </ul>
          )}
          <button ref={closeRef} type="button" className="cta" onClick={onCloseSprint}>
            {finalSprint ? 'SHIP THE GAME' : `END SPRINT ${run.sprint}`}
            <span>{finalSprint ? 'see the review' : `start sprint ${run.sprint + 1}`}</span>
          </button>
        </div>
      )}
    </section>
  )
}
