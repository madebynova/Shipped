import { RELEASE_WINDOW, isUpdateWindowOpen, liveSprintNumber } from '../engine'
import type { RunState } from '../engine'
import { sprintsText } from './format'
import { HELP } from './help'
import Tooltip from './Tooltip'

/**
 * "LIVE SPRINT 3" plus a small track that fills as the update window gets closer. A live game has no
 * deadline, so unlike the development track there is no total: just the sprints since launch and the version.
 */
export default function LiveTrack({ run }: { run: RunState }) {
  const live = run.live!
  const number = liveSprintNumber(run)
  const open = isUpdateWindowOpen(live)
  const filled = Math.min(RELEASE_WINDOW, live.sprintsSinceRelease)
  const left = RELEASE_WINDOW - filled

  return (
    <Tooltip as="div" className="sprint-track" align="end" text={HELP.liveTrack}>
      <div className="sprint-label" aria-label={`Live sprint ${number}, version 1.${live.minor}`}>
        <span className="sprint-word">LIVE SPRINT</span>
        <span key={number} className="sprint-num">
          {number}
        </span>
        <span className="sprint-total">v1.{live.minor}</span>
      </div>
      <div className="segments" aria-hidden="true">
        {Array.from({ length: RELEASE_WINDOW }, (_, i) => (
          <span key={i} className={['seg', i < filled ? 'done' : '', open ? 'window' : ''].join(' ')} />
        ))}
      </div>
      <div className="sprint-note">
        {open ? 'Update window open · release for the full sales boost' : `Update window opens in ${sprintsText(left)}`}
      </div>
    </Tooltip>
  )
}
