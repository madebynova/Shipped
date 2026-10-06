import { SHIP_UNLOCK_SPRINT } from '../engine'

interface Props {
  sprint: number
  /** Sprints in this run (8 in the full game, 6 in the tutorial). */
  total: number
}

/** "SPRINT 3 / 8" plus a segmented track that shows where shipping opens and the deadline. */
export default function SprintTrack({ sprint, total }: Props) {
  const segments = Array.from({ length: total }, (_, i) => i + 1)
  const note =
    sprint < SHIP_UNLOCK_SPRINT
      ? `Shipping unlocks in sprint ${SHIP_UNLOCK_SPRINT}`
      : sprint < total
        ? `Ship window open · deadline in ${total - sprint} ${total - sprint === 1 ? 'sprint' : 'sprints'}`
        : 'Final sprint · the game ships after your last action'

  return (
    <div className="sprint-track" aria-label={`Sprint ${sprint} of ${total}`}>
      <div className="sprint-label">
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
    </div>
  )
}
