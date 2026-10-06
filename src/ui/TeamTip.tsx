import { CloseIcon } from './icons'

interface Props {
  text: string
  onDismiss: () => void
}

/** A small, dismissible hint from "the team". Shown only in the tutorial; never repeats. */
export default function TeamTip({ text, onDismiss }: Props) {
  return (
    <aside className="team-tip" aria-label="Team tip">
      <div className="team-tip-head">
        <span className="team-tip-badge">TEAM TIP</span>
        <button type="button" className="tip-close" aria-label="Dismiss tip" onClick={onDismiss}>
          <CloseIcon />
        </button>
      </div>
      <p>{text}</p>
      <button type="button" className="link" onClick={onDismiss}>
        Got it
      </button>
    </aside>
  )
}
