import type { RunState } from '../engine'
import type { TutorialEvent } from '../tutorial/script'
import Modal from './Modal'

interface Props {
  event: TutorialEvent
  run: RunState
  onDismiss: () => void
}

/** A scripted teaching moment: what is going on, and WHY the choice matters. */
export default function TutorialEventCard({ event, run, onDismiss }: Props) {
  return (
    <Modal
      title={event.title}
      kicker={`${event.kicker} · MY FIRST GAME`}
      onClose={onDismiss}
      className="event-card"
      closeOnBackdrop={false}
      bare
    >
      <div className="event-body">
        {event.body(run).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <div className="event-why">
        <span className="eyebrow">WHY IT MATTERS</span>
        <p>{event.why(run)}</p>
      </div>
      <button type="button" className="cta" data-autofocus onClick={onDismiss}>
        GOT IT
        <span>sprint {run.sprint} continues</span>
      </button>
    </Modal>
  )
}
