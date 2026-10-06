import { findLiveEvent, liveRunway, previewRelease, whyCannotChoose } from '../engine'
import type { Release, RunState } from '../engine'
import { formatMoney, sprintsText } from './format'
import Modal from './Modal'

/** The patch notes of an update that was just published: what changed, how the community took it, what it earned. */
export function ReleaseModal({ release, onClose }: { release: Release; onClose: () => void }) {
  const gain = release.legacyAfter - release.legacyBefore
  const summary = release.summary.charAt(0).toUpperCase() + release.summary.slice(1)
  // With one small change the bullet would only repeat the headline, so leave it out.
  const repeatsHeadline = release.notes.length === 1 && release.notes[0].toLowerCase() === release.summary.toLowerCase()
  return (
    <Modal
      title={`${release.version} released`}
      kicker="PATCH NOTES"
      onClose={onClose}
      className="event-card release-card"
      closeOnBackdrop={false}
      bare
    >
      <p className="release-summary">{summary}.</p>
      {!repeatsHeadline && (
        <ul className="patch-notes">
          {release.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      <blockquote className="reaction">{release.reaction}</blockquote>
      <div className="release-stats">
        <div>
          <span className="eyebrow">LEGACY SCORE</span>
          <b>
            {release.legacyBefore} → {release.legacyAfter}
            {gain !== 0 && <em className={gain > 0 ? 'up' : 'down'}> ({gain > 0 ? `+${gain}` : `−${Math.abs(gain)}`})</em>}
          </b>
        </div>
        <div>
          <span className="eyebrow">SALES SPIKE</span>
          <b>{release.spike > 0 ? `+${formatMoney(release.spike)} a sprint` : 'none'}</b>
        </div>
      </div>
      {release.early && (
        <p className="release-early">
          Released early, so the sales boost was smaller. Waiting for the update window (every 4 live sprints) earns more.
        </p>
      )}
      <button type="button" className="cta" data-autofocus onClick={onClose}>
        CONTINUE
        <span>back to the sprint</span>
      </button>
    </Modal>
  )
}

/** A live event: something happened to the game and the player has to decide. Every choice has a price. */
export function LiveEventModal({ run, onChoose }: { run: RunState; onChoose: (choiceId: string) => void }) {
  const event = findLiveEvent(run.live?.pendingEvent ?? null)
  if (!event) return null
  return (
    <Modal
      title={event.title}
      kicker={`${event.kicker} · LIVE EVENT`}
      onClose={() => undefined} // an event has to be decided: Esc does nothing
      className="event-card"
      closeOnBackdrop={false}
      bare
    >
      <div className="event-body">
        {event.body(run).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <div className="event-choices">
        {event.choices.map((choice) => {
          const blocked = whyCannotChoose(run, choice.id)
          return (
            <button
              key={choice.id}
              type="button"
              className="event-choice"
              disabled={blocked !== null}
              onClick={() => onChoose(choice.id)}
            >
              <span className="choice-top">
                <b className="choice-label">{choice.label}</b>
                {choice.cost ? <span className="choice-cost">{formatMoney(choice.cost)}</span> : null}
              </span>
              <span className="choice-hint">{blocked ?? choice.hint}</span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

interface WarningProps {
  run: RunState
  onRelease: () => void
  onRetire: () => void
  onDismiss: () => void
}

/**
 * The warning sprint: the account cannot cover another sprint. The team lays out the options. If nothing
 * changes, the studio closes at the end of this sprint; the player is told so plainly.
 */
export function WarningModal({ run, onRelease, onRetire, onDismiss }: WarningProps) {
  const preview = previewRelease(run)
  const runway = liveRunway(run)
  // A release only helps if it brings in money. One that would not beat your best score earns nothing.
  const worthIt = preview.ok && preview.spike > 0
  return (
    <Modal
      title="The money is running out"
      kicker="TEAM MEETING · WARNING SPRINT"
      onClose={onDismiss}
      className="event-card warning-card"
      closeOnBackdrop={false}
      bare
    >
      <div className="event-body">
        <p>
          The revenue account holds {formatMoney(run.money)}, and it cannot cover another sprint ({sprintsText(runway)} of
          runway). This is the warning sprint.
        </p>
        <p>
          <b>If the account still cannot pay at the end of this sprint, the studio closes</b> and the game is retired as it
          stands. You have until then to turn it around.
        </p>
      </div>
      <div className="event-choices">
        <button type="button" className="event-choice" disabled={!worthIt} onClick={onRelease}>
          <span className="choice-top">
            <b className="choice-label">RELEASE AN UPDATE</b>
            {worthIt ? <span className="choice-cost good">+{formatMoney(preview.spike)}/sprint</span> : null}
          </span>
          <span className="choice-hint">
            {worthIt
              ? 'Brings in a sales spike now. Fix and polish first and the spike is bigger.'
              : preview.ok
                ? `Not worth it yet: legacy would go ${preview.legacyBefore} → ${preview.legacyAfter}, with no sales spike. Fix and polish first.`
                : (preview.reason ?? 'Nothing new to release yet: fix, polish or build something first.')}
          </span>
        </button>
        <button type="button" className="event-choice" data-autofocus onClick={onDismiss}>
          <span className="choice-top">
            <b className="choice-label">I&apos;LL HANDLE IT</b>
          </span>
          <span className="choice-hint">
            Use this sprint: polish and fix for a bigger release, run a HYPE push, or cancel a promise you cannot keep.
          </span>
        </button>
        <button type="button" className="event-choice" onClick={onRetire}>
          <span className="choice-top">
            <b className="choice-label">RETIRE GAME</b>
          </span>
          <span className="choice-hint">End it now, on your terms, with the legacy score you have today.</span>
        </button>
      </div>
    </Modal>
  )
}
