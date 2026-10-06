import { SHIP_UNLOCK_SPRINT } from '../engine'
import { HELP } from './help'
import Tooltip from './Tooltip'

interface Props {
  sprint: number
  /** Sprints in this run (8 in the full game, 6 in the tutorial). */
  total: number
}

/** "SPRINT 3 / 8" plus a segmented track that shows where shipping opens and the deadline. */
export default function SprintTrack({ sprint, total }: Props) {
  const segments = Array.from({ length: total }, (_, i) => i + 1)
  const left = total - sprint
  const note =
    sprint < SHIP_UNLOCK_SPRINT
      ? `Shipping unlocks in sprint ${SHIP_UNLOCK_SPRINT}`
      : sprint < total
        ? `Ship window open · deadline in ${left} ${left === 1 ? 'sprint' : 'sprints'}`
        : 'Final sprint · the game ships after your last action'

  return (
    <Tooltip as="div" className="sprint-track" align="end" text={HELP.sprint(total)}>
      <div className="sprint-label" aria-label={`Sprint ${sprint} of ${total}`}>
        <span className="sprint-word">SPRINT</span>
        <span key={sprint} className="sprint-num">
          {sprint}
        </span>
        <span className="sprint-total">/ {total}</span>
      </div>
      <div className="segments" aria-hidden="true">
        {segments.map((n) => (
          <span
            key={n}
            className={[
              'seg',
              n < sprint ? 'done' : '',
              n === sprint ? 'current' : '',
              n >= SHIP_UNLOCK_SPRINT ? 'window' : '',
              n === total ? 'deadline' : '',
            ].join(' ')}
          />
        ))}
      </div>
      <div className="sprint-note">{note}</div>
    </Tooltip>
  )
}
