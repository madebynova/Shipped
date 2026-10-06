import { useRef } from 'react'
import type { RefObject } from 'react'
import { POLISHED_AT, buildCost } from '../engine'
import type { ActionPreview, ActionType, Feature } from '../engine'
import { signed } from './format'
import { glow, useOnChange } from './motion'

interface Props {
  feature: Feature
  /** Keyboard number (1-6) used while choosing a target. */
  hotkey: number
  /** The action waiting for a target, or null. */
  targeting: ActionType | null
  /** Why this feature can't be the target, or null if it can. */
  blockedReason: string | null
  preview: ActionPreview | null
  onPick: () => void
}

function previewLine(type: ActionType, p: ActionPreview, feature: Feature): string {
  if (!p.ok || !p.feature) return ''
  const { before, after } = p.feature
  const bugs = p.deltas.bugs !== 0 ? ` · ${signed(p.deltas.bugs)} ${Math.abs(p.deltas.bugs) === 1 ? 'bug' : 'bugs'}` : ''
  const scope = p.scopeAfter !== p.scopeBefore ? ` · SCOPE ${p.scopeAfter}` : ''
  if (type === 'BUILD' && before.state === 'PLANNED') {
    const body =
      after.state !== 'PLANNED'
        ? 'Becomes PLAYABLE'
        : `Progress ${after.progress}/${buildCost(feature)}`
    return `${body}${bugs}${scope}`
  }
  const state = after.state !== before.state ? ` · ${after.state}` : ''
  return `Quality ${before.quality} → ${after.quality}${state}${bugs}${scope}`
}

export default function FeatureCard({ feature, hotkey, targeting, blockedReason, preview, onPick }: Props) {
  const ref = useRef<HTMLElement>(null)
  const cost = buildCost(feature)
  const built = feature.state !== 'PLANNED'
  const picking = targeting !== null
  const pickable = picking && blockedReason === null

  // Visible reaction when the feature changes state or moves forward.
  useOnChange(feature.state, () => glow(ref.current, feature.state === 'POLISHED' ? '255, 213, 106' : '90, 169, 255', 14, 900))
  useOnChange(`${feature.progress}/${feature.quality}`, () => glow(ref.current, '255, 178, 36', 6, 600))

  const body = (
    <>
      <div className="card-head">
        <h3 className="card-name">{feature.name}</h3>
        <span className={`badge badge-${feature.state.toLowerCase()}`}>{feature.state}</span>
      </div>
      <p className="card-desc">{feature.description}</p>

      <div className="card-meter">
        <div className="card-meter-row">
          <span className="pips" aria-label={`Complexity ${feature.complexity} of 3`}>
            {[1, 2, 3].map((n) => (
              <i key={n} className={n <= feature.complexity ? 'on' : ''} />
            ))}
            <em>COMPLEXITY</em>
          </span>
          <span className="card-figure">
            {built ? (
              <>
                QUALITY <b>{feature.quality}</b>
              </>
            ) : (
              <>
                BUILT <b>{feature.progress}</b>/{cost}
              </>
            )}
          </span>
        </div>
        <div className={`bar ${built ? 'bar-quality' : 'bar-progress'}`} aria-hidden="true">
          <i style={{ width: `${built ? feature.quality : (feature.progress / cost) * 100}%` }} />
          {built && <span className="bar-mark" style={{ left: `${POLISHED_AT}%` }} />}
        </div>
      </div>

      {picking && (
        <div className={`card-foot ${pickable ? 'foot-ok' : 'foot-blocked'}`}>
          {pickable ? (
            <>
              <kbd>{hotkey}</kbd>
              <span>{preview ? previewLine(targeting, preview, feature) : `${targeting} ${feature.name}`}</span>
            </>
          ) : (
            <span>{blockedReason}</span>
          )}
        </div>
      )}
    </>
  )

  const className = [
    'card',
    `state-${feature.state.toLowerCase()}`,
    picking ? (pickable ? 'pickable' : 'blocked') : '',
  ].join(' ')

  if (picking) {
    return (
      <button
        ref={ref as RefObject<HTMLButtonElement>}
        type="button"
        className={className}
        disabled={!pickable}
        onClick={onPick}
        aria-label={`${targeting} ${feature.name}`}
      >
        {body}
      </button>
    )
  }
  return (
    <article ref={ref} className={className}>
      {body}
    </article>
  )
}
