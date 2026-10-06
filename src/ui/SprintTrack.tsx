import { SHIP_UNLOCK_SPRINT, TOTAL_SPRINTS } from '../engine'

interface Props {
  sprint: number
}

/** "SPRINT 3 / 8" plus a segmented track that shows where shipping opens and the deadline. */
export default function SprintTrack({ sprint }: Props) {
  const segments = Array.from({ length: TOTAL_SPRINTS }, (_, i) => i + 1)
  const note =
    sprint < SHIP_UNLOCK_SPRINT
      ? `Shipping unlocks in sprint ${SHIP_UNLOCK_SPRINT}`
      : sprint < TOTAL_SPRINTS
        ? `Ship window open · deadline in ${TOTAL_SPRINTS - sprint} ${TOTAL_SPRINTS - sprint === 1 ? 'sprint' : 'sprints'}`
        : 'Final sprint · the game ships after your last action'

  return (
    <div className="sprint-track" aria-label={`Sprint ${sprint} of ${TOTAL_SPRINTS}`}>
      <div className="sprint-label">
        <span className="sprint-word">SPRINT</span>
        <span key={sprint} className="sprint-num">
          {sprint}
        </span>
        <span className="sprint-total">/ {TOTAL_SPRINTS}</span>
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
              n === TOTAL_SPRINTS ? 'deadline' : '',
            ].join(' ')}
          />
        ))}
      </div>
      <div className="sprint-note">{note}</div>
    </div>
  )
}
