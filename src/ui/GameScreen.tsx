import { useEffect, useMemo, useState } from 'react'
import { SCOPE_HINT, SCOPE_LEVELS, TUTORIAL_PASS_SCORE, getScope, previewAction, sprintUpkeep, validateAction } from '../engine'
import type { ActionType, FeatureId } from '../engine'
import { findEvent, findTip } from '../tutorial/script'
import ActionPanel from './ActionPanel'
import FeatureCard from './FeatureCard'
import { HELP } from './help'
import ResourceBar from './ResourceBar'
import ShipBar from './ShipBar'
import SprintTrack from './SprintTrack'
import { useGameStore } from './store'
import { targetsFor } from './targets'
import TeamTip from './TeamTip'
import Toolbar from './Toolbar'
import Tooltip from './Tooltip'
import TutorialEventCard from './TutorialEventCard'

const HOTKEYS: Record<string, ActionType> = {
  b: 'BUILD',
  p: 'POLISH',
  f: 'FIX',
  h: 'HYPE',
  r: 'REST',
}

export default function GameScreen() {
  const run = useGameStore((s) => s.run)
  const perform = useGameStore((s) => s.perform)
  const closeSprint = useGameStore((s) => s.closeSprint)
  const ship = useGameStore((s) => s.ship)
  const progress = useGameStore((s) => s.tutorial)
  const dismissEvent = useGameStore((s) => s.dismissTutorialEvent)
  const dismissTip = useGameStore((s) => s.dismissTutorialTip)

  // BUILD and POLISH need a target: the action waits here until a feature is picked.
  const [pending, setPending] = useState<ActionType | null>(null)

  const scope = useMemo(() => (run ? getScope(run.features) : null), [run])

  // Leaving targeting mode whenever the situation changes underneath it.
  const sprint = run?.sprint
  const actionsLeft = run?.actionsLeft
  useEffect(() => {
    setPending(null)
  }, [sprint, actionsLeft])

  const tutorial = run?.config.kind === 'tutorial'
  const event = tutorial ? findEvent(progress.activeEvent) : undefined
  const tip = tutorial && !event ? findTip(progress.activeTip?.id ?? null) : undefined

  const choose = (type: ActionType) => {
    if (!run) return
    if (type === 'BUILD' || type === 'POLISH') {
      if (targetsFor(run, type).length === 0) return
      setPending((p) => (p === type ? null : type))
      return
    }
    setPending(null)
    perform({ type })
  }

  const pickFeature = (featureId: FeatureId) => {
    if (!run || !pending) return
    perform({ type: pending, featureId })
    setPending(null)
  }

  // Keyboard: B P F H R choose an action, 1-6 pick a feature, Esc cancels.
  useEffect(() => {
    if (!run) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return
      // A dialog (glossary, tutorial card) owns the keyboard while it is open.
      if (document.querySelector('[aria-modal="true"]')) return
      if (e.key === 'Escape') {
        setPending(null)
        return
      }
      if (run.actionsLeft === 0) return
      if (pending && /^[1-6]$/.test(e.key)) {
        const feature = run.features[Number(e.key) - 1]
        if (feature && validateAction(run, { type: pending, featureId: feature.id }) === null) {
          perform({ type: pending, featureId: feature.id })
          setPending(null)
        }
        return
      }
      const type = HOTKEYS[e.key.toLowerCase()]
      if (!type) return
      if (type === 'BUILD' || type === 'POLISH') {
        if (targetsFor(run, type).length === 0) return
        setPending((p) => (p === type ? null : type))
      } else if (validateAction(run, { type }) === null) {
        setPending(null)
        perform({ type })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run, pending, perform])

  if (!run || !scope) return null

  const scopeIndex = SCOPE_LEVELS.indexOf(scope.level)

  return (
    <div className="game">
      <header className="topbar">
        <div className="title-block">
          <div className="eyebrow">NOW DEVELOPING</div>
          <h1 className="game-title">{run.concept.title}</h1>
          <div className="tag-row">
            <span className="genre-tag">{run.concept.genre}</span>
            {tutorial && (
              <span className="genre-tag tutorial-tag" title="You are in the tutorial">
                MY FIRST GAME · PASS WITH {TUTORIAL_PASS_SCORE}+
              </span>
            )}
          </div>
        </div>
        <SprintTrack sprint={run.sprint} total={run.config.totalSprints} />
        <Toolbar />
      </header>

      <ResourceBar
        upkeep={sprintUpkeep(scope.level)}
        sprintsLeft={run.config.totalSprints - run.sprint}
        money={run.money}
        morale={run.morale}
        hype={run.hype}
        bugs={run.bugs}
      />

      <main className="stage">
        <section className="features" aria-label="Features">
          <div className="section-head">
            <h2 className="eyebrow">FEATURES</h2>
            <Tooltip
              as="div"
              className={`scope scope-${scope.level.toLowerCase()}`}
              align="end"
              text={HELP.scope}
            >
              <span className="scope-label">SCOPE</span>
              <span className="scope-pips" aria-hidden="true">
                {SCOPE_LEVELS.map((l, i) => (
                  <i key={l} className={i <= scopeIndex ? 'on' : ''} />
                ))}
              </span>
              <b className="scope-level">{scope.level}</b>
            </Tooltip>
          </div>
          {pending ? (
            <div className="targeting" role="status">
              <span>
                <b>{pending}</b>: choose a feature
              </span>
              <button type="button" className="link" onClick={() => setPending(null)}>
                cancel <kbd>Esc</kbd>
              </button>
            </div>
          ) : (
            <p className="scope-hint">{SCOPE_HINT[scope.level]}</p>
          )}

          <div className={`card-grid ${run.features.length <= 4 ? 'cards-few' : ''}`}>
            {run.features.map((feature, i) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                hotkey={i + 1}
                targeting={pending}
                blockedReason={pending ? validateAction(run, { type: pending, featureId: feature.id }) : null}
                preview={pending ? previewAction(run, { type: pending, featureId: feature.id }) : null}
                onPick={() => pickFeature(feature.id)}
              />
            ))}
          </div>
        </section>

        <aside className="side">
          {tip && <TeamTip key={tip.id} text={tip.text(run)} onDismiss={dismissTip} />}
          <ActionPanel
            key={run.sprint}
            run={run}
            pending={pending}
            onChoose={choose}
            onCloseSprint={closeSprint}
          />
          <section className="panel log" aria-label="Activity log">
            <div className="eyebrow">LATEST</div>
            <ul aria-live="polite">
              {[...run.log]
                .slice(-6)
                .reverse()
                .map((entry, i) => (
                  <li key={entry.id} className={`tone-${entry.tone} ${i === 0 ? 'newest' : ''}`}>
                    {entry.text}
                  </li>
                ))}
            </ul>
          </section>
        </aside>
      </main>

      <ShipBar run={run} onShip={ship} />

      {event && <TutorialEventCard key={event.id} event={event} run={run} onDismiss={dismissEvent} />}
    </div>
  )
}
