import { useEffect, useState } from 'react'
import { RELEASE_WINDOW, computeLegacy, isUpdateWindowOpen, previewRelease } from '../engine'
import type { RunState } from '../engine'
import { sprintsText } from './format'
import { HELP } from './help'
import { useGameStore } from './store'
import Tooltip from './Tooltip'

/**
 * The persistent bar at the bottom of a live game, the counterpart of SHIP GAME: RELEASE UPDATE (free, any time,
 * best once the window is open) and RETIRE GAME (always possible, asks first).
 */
export default function LiveBar({ run }: { run: RunState }) {
  const release = useGameStore((s) => s.release)
  const retire = useGameStore((s) => s.retire)
  const [confirming, setConfirming] = useState(false)

  // Any change to the run (a new action, a new sprint) cancels a pending confirmation.
  useEffect(() => {
    setConfirming(false)
  }, [run.sprint, run.actionsLeft])

  const live = run.live!
  const preview = previewRelease(run)
  const open = isUpdateWindowOpen(live)
  const legacy = computeLegacy(run)
  const gain = preview.legacyAfter - preview.legacyBefore

  if (confirming) {
    return (
      <footer className="shipbar open livebar">
        <div className="ship-confirm" role="alertdialog" aria-label="Confirm retiring">
          <p>
            <b>Retire {run.concept.title} now?</b> The legacy card is written and the run ends. Your launch score stays
            exactly as it was. There is no undo.
          </p>
          <div className="ship-confirm-actions">
            <button type="button" className="ship-btn go" onClick={retire} autoFocus>
              YES, RETIRE IT
            </button>
            <button type="button" className="ghost" onClick={() => setConfirming(false)}>
              Keep it running
            </button>
          </div>
        </div>
      </footer>
    )
  }

  let headline: string
  let facts: string
  if (legacy.complete) {
    headline = 'COMPLETE: every feature polished, no bugs, every promise kept.'
    facts = preview.ok
      ? `Release it, or retire now to stamp the game COMPLETE (+${legacy.completeBonus} legacy).`
      : 'Retire now to stamp the game COMPLETE before bugs creep back in.'
  } else if (!preview.ok) {
    headline = preview.reason ?? 'Nothing to release yet.'
    facts = `Fix, polish or build something, then release it. The update window opens ${open ? 'now' : `in ${sprintsText(RELEASE_WINDOW - live.sprintsSinceRelease)}`}.`
  } else if (gain < 0) {
    // Honest about a bad idea: the update is allowed, but the player should know what it would do.
    headline = `v1.${live.minor + 1} would make things worse: legacy ${preview.legacyBefore} → ${preview.legacyAfter} (−${-gain})`
    facts = 'Players would notice, and there is no sales spike. Fix bugs and polish first, then release.'
  } else if (preview.spike <= 0) {
    headline = `v1.${live.minor + 1} would change little: legacy ${preview.legacyBefore} → ${preview.legacyAfter}`
    facts = 'No sales spike, because it does not beat your best published score. Improve the game first.'
  } else {
    headline = `v1.${live.minor + 1} is ready: legacy ${preview.legacyBefore} → ${preview.legacyAfter} (+${gain})`
    facts = preview.early
      ? `Early release: sales +${preview.spike} a sprint. Wait for the window (${sprintsText(RELEASE_WINDOW - live.sprintsSinceRelease)}) for a bigger boost.`
      : `Update window open: sales +${preview.spike} a sprint.`
  }

  return (
    <footer className="shipbar open livebar">
      <Tooltip text={HELP.release} placement="top" focusable={false} className="ship-tip">
        <button type="button" className="ship-btn release-btn" disabled={!preview.ok} onClick={release}>
          RELEASE UPDATE
        </button>
      </Tooltip>
      <div className="ship-copy">
        <p className="ship-tagline">{headline}</p>
        <p className="ship-facts">{facts}</p>
      </div>
      <Tooltip text={HELP.retire} placement="top" focusable={false} align="end">
        <button type="button" className="ghost retire-btn" onClick={() => setConfirming(true)}>
          RETIRE GAME
        </button>
      </Tooltip>
    </footer>
  )
}
