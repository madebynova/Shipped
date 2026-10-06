import { useEffect, useState } from 'react'
import { SHIP_UNLOCK_SPRINT, canShip, getScope, sprintUpkeep } from '../engine'
import type { RunState } from '../engine'
import { formatMoney, moneyStatus } from './format'

interface Props {
  run: RunState
  onShip: () => void
}

/** The persistent SHIP GAME bar. Locked until sprint 4, then a real decision. */
export default function ShipBar({ run, onShip }: Props) {
  const [confirming, setConfirming] = useState(false)
  const open = canShip(run)

  // Any change to the run (a new action, a new sprint) cancels a pending confirmation.
  useEffect(() => {
    setConfirming(false)
  }, [run.sprint, run.actionsLeft])

  if (!open) {
    return (
      <footer className="shipbar locked">
        <button type="button" className="ship-btn" disabled>
          <span className="lock" aria-hidden="true" />
          SHIP GAME
        </button>
        <p className="ship-copy">
          <b>Shipping unlocks in sprint {SHIP_UNLOCK_SPRINT}.</b> Until then you are building toward something shippable.
        </p>
      </footer>
    )
  }

  const built = run.features.filter((f) => f.state !== 'PLANNED').length
  const polished = run.features.filter((f) => f.state === 'POLISHED').length
  const sprintsLeft = run.config.totalSprints - run.sprint
  const status = moneyStatus(run.money, sprintUpkeep(getScope(run.features).level))
  const urgency = run.sprint >= 7 ? 'late' : run.sprint >= 6 ? 'mid' : 'early'

  return (
    <footer className={`shipbar open urgency-${urgency}`}>
      {confirming ? (
        <div className="ship-confirm" role="alertdialog" aria-label="Confirm shipping">
          <p>
            <b>Ship {run.concept.title} now?</b> The run ends and the review begins. There is no undo.
          </p>
          <div className="ship-confirm-actions">
            <button type="button" className="ship-btn go" onClick={onShip} autoFocus>
              YES, SHIP IT
            </button>
            <button type="button" className="ghost" onClick={() => setConfirming(false)}>
              Keep developing
            </button>
          </div>
        </div>
      ) : (
        <>
          <button type="button" className="ship-btn" onClick={() => setConfirming(true)}>
            SHIP GAME
          </button>
          <div className="ship-copy">
            <p className="ship-tagline">
              {sprintsLeft === 0
                ? 'Final sprint. You can ship the moment you are ready.'
                : 'You can ship now… but should you?'}
            </p>
            <p className="ship-facts">
              Ships as it stands: <b>{built}</b> {built === 1 ? 'feature' : 'features'}
              {polished > 0 ? ` (${polished} polished)` : ''} · <b>{run.bugs}</b> {run.bugs === 1 ? 'bug' : 'bugs'} ·{' '}
              hype <b>{run.hype}</b> · <span className={`mood-${status.mood}`}>{formatMoney(run.money)}, {status.label.toLowerCase()}</span>
            </p>
          </div>
        </>
      )}
    </footer>
  )
}
