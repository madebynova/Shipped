import { useState } from 'react'
import { computeLegacy, liveRunway, promiseAge, sprintEndEffects, unresolvedPromises } from '../engine'
import type { FeatureId, RunState } from '../engine'
import { featureLabel, formatMoney, sprintsText } from './format'
import { HELP } from './help'
import LegacyMath from './LegacyMath'
import { useGameStore } from './store'
import Tooltip from './Tooltip'

/**
 * The side panel of a live game: where the money is going, whether the game is COMPLETE, and the promises still
 * hanging over it, each with a way to cancel it. (The two scores live in the top row, next to the other numbers.)
 */
export default function LivePanel({ run }: { run: RunState }) {
  const cancelPromise = useGameStore((s) => s.cancelPromise)
  const [confirming, setConfirming] = useState<FeatureId | null>(null)

  const live = run.live!
  const legacy = computeLegacy(run)
  const fx = sprintEndEffects(run)
  const income = fx.income ?? 0
  const upkeep = fx.upkeep ?? 0
  const net = income - upkeep
  const runway = liveRunway(run)
  const open = unresolvedPromises(run)

  return (
    <section className="panel live-panel" aria-label="Live service">
      <header className="panel-head">
        <div className="eyebrow">LIVE SERVICE</div>
        <Tooltip as="span" className="version-tag" text={<LegacyMath legacy={legacy} />} align="end">
          v1.{live.minor} · legacy math
        </Tooltip>
      </header>

      {legacy.complete && (
        <Tooltip as="div" className="complete-chip" text={HELP.complete}>
          COMPLETE · retire now to stamp it
        </Tooltip>
      )}

      <dl className="money-lines">
        <div>
          <dt>Sales</dt>
          <dd>+{formatMoney(income)} a sprint</dd>
        </div>
        <div>
          <dt>Upkeep</dt>
          <dd>−{formatMoney(upkeep)} a sprint</dd>
        </div>
        <div>
          <dt>Net</dt>
          <dd className={net >= 0 ? 'up' : 'down'}>
            {net >= 0 ? '+' : '−'}
            {formatMoney(Math.abs(net))} a sprint
          </dd>
        </div>
        <div>
          <Tooltip as="span" text={HELP.runway}>
            <dt>Runway</dt>
          </Tooltip>
          <dd className={runway <= 1 ? 'down' : ''}>{runway >= 99 ? '99+ sprints' : sprintsText(runway)}</dd>
        </div>
      </dl>

      {open.length > 0 && (
        <div className="promises">
          <Tooltip text={HELP.promises}>
            <span className="eyebrow">PROMISES STILL OPEN</span>
          </Tooltip>
          <ul>
            {open.map((id) => {
              const age = promiseAge(run, id)
              const name = featureLabel(id)
              return (
                <li key={id}>
                  <span className="promise-name">{name}</span>
                  <span className="promise-age">{age === 0 ? 'new' : `${sprintsText(age)} late`}</span>
                  {confirming === id ? (
                    <span className="promise-confirm">
                      <button
                        type="button"
                        className="link danger"
                        onClick={() => {
                          cancelPromise(id)
                          setConfirming(null)
                        }}
                      >
                        yes, cancel {name}
                      </button>
                      <button type="button" className="link" onClick={() => setConfirming(null)}>
                        keep it
                      </button>
                    </span>
                  ) : (
                    <Tooltip text={HELP.cancelPromise} align="end">
                      <button type="button" className="link" onClick={() => setConfirming(id)}>
                        cancel
                      </button>
                    </Tooltip>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
