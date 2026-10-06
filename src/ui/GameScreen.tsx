import { useEffect, useMemo, useState } from 'react'
import {
  SCOPE_HINT,
  SCOPE_LEVELS,
  TUTORIAL_PASS_SCORE,
  computeLegacy,
  getScope,
  isPromised,
  liveRunway,
  liveUpkeep,
  previewAction,
  promiseAge,
  sprintEndEffects,
  sprintUpkeep,
  validateAction,
} from '../engine'
import type { ActionType, FeatureId, RunState } from '../engine'
import { findEvent, findTip } from '../tutorial/script'
import ActionPanel from './ActionPanel'
import FeatureCard from './FeatureCard'
import type { CardMark } from './FeatureCard'
import { sprintsText } from './format'
import { HELP } from './help'
import LiveBar from './LiveBar'
import { LiveEventModal, ReleaseModal, WarningModal } from './LiveModals'
import LegacyMath from './LegacyMath'
import LivePanel from './LivePanel'
import LiveTrack from './LiveTrack'
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

/**
 * What a card says about the pitch. A game's seed features are what it promises, so they carry a star. After launch a
 * promised feature that was never built says how overdue it is, and a cancelled one says so. Not shown in the tutorial.
 */
function markFor(run: RunState, id: FeatureId): CardMark | undefined {
  if (run.config.kind === 'tutorial') return undefined
  const live = run.live
  if (live?.cancelled.includes(id)) return { kind: 'cancelled', text: 'CANCELLED' }
  if (!isPromised(run, id)) return undefined
  const feature = run.features.find((f) => f.id === id)
  if (live && feature?.state === 'PLANNED') {
    const age = promiseAge(run, id)
    return { kind: 'promised', text: age === 0 ? 'PROMISED, NOT BUILT' : `PROMISED, ${sprintsText(age)} LATE` }
  }
  return { kind: 'pitch', text: 'IN THE PITCH' }
}

export default function GameScreen() {
  const run = useGameStore((s) => s.run)
  const perform = useGameStore((s) => s.perform)
  const closeSprint = useGameStore((s) => s.closeSprint)
  const ship = useGameStore((s) => s.ship)
  const progress = useGameStore((s) => s.tutorial)
  const dismissEvent = useGameStore((s) => s.dismissTutorialEvent)
  const dismissTip = useGameStore((s) => s.dismissTutorialTip)
  const lastRelease = useGameStore((s) => s.lastRelease)
  const dismissRelease = useGameStore((s) => s.dismissRelease)
  const decideEvent = useGameStore((s) => s.decideEvent)
  const release = useGameStore((s) => s.release)
  const retire = useGameStore((s) => s.retire)

  // BUILD and POLISH need a target: the action waits here until a feature is picked.
  const [pending, setPending] = useState<ActionType | null>(null)
  // The sprint in which the player dismissed the "money is running out" warning (so it does not keep coming back).
  const [warningSeen, setWarningSeen] = useState<number | null>(null)

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
  const live = run.phase === 'live' ? run.live : null
  const fx = sprintEndEffects(run)
  const legacyNow = live ? computeLegacy(run) : null
  const liveEventOpen = Boolean(live?.pendingEvent)
  const showWarning = live !== null && live.warned && !liveEventOpen && !lastRelease && warningSeen !== run.sprint

  return (
    <div className="game">
      <header className="topbar">
        <div className="title-block">
          <div className="eyebrow">{live ? 'LIVE SERVICE' : 'NOW DEVELOPING'}</div>
          <h1 className="game-title">{run.concept.title}</h1>
          <div className="tag-row">
            <span className="genre-tag">{run.concept.genre}</span>
            {live && <span className="genre-tag live-tag">LIVE · v1.{live.minor}</span>}
            {tutorial && (
              <span className="genre-tag tutorial-tag" title="You are in the tutorial">
                MY FIRST GAME · PASS WITH {TUTORIAL_PASS_SCORE}+
              </span>
            )}
          </div>
        </div>
        {live ? <LiveTrack run={run} /> : <SprintTrack sprint={run.sprint} total={run.config.totalSprints} />}
        <Toolbar />
      </header>

      <ResourceBar
        upkeep={live ? liveUpkeep(scope.level) : sprintUpkeep(scope.level)}
        sprintsLeft={run.config.totalSprints - run.sprint}
        live={live ? { income: fx.income ?? 0, runway: liveRunway(run) } : undefined}
        legacy={
          live && legacyNow
            ? { score: legacyNow.score, band: legacyNow.band, launch: live.launchScore, tip: <LegacyMath legacy={legacyNow} /> }
            : undefined
        }
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
                mark={markFor(run, feature.id)}
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
          {live && <LivePanel run={run} />}
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

      {live ? <LiveBar run={run} /> : <ShipBar run={run} onShip={ship} />}

      {event && <TutorialEventCard key={event.id} event={event} run={run} onDismiss={dismissEvent} />}
      {liveEventOpen && <LiveEventModal run={run} onChoose={decideEvent} />}
      {showWarning && (
        <WarningModal
          run={run}
          onDismiss={() => setWarningSeen(run.sprint)}
          onRelease={() => {
            setWarningSeen(run.sprint)
            release()
          }}
          onRetire={retire}
        />
      )}
      {lastRelease && <ReleaseModal release={lastRelease} onClose={dismissRelease} />}
    </div>
  )
}
