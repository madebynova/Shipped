import { CONCEPTS, beginnerConcepts } from '../content/concepts'
import type { ConceptTemplate } from '../content/concepts'
import { HELP } from './help'
import { featureLabel } from './format'
import Tooltip from './Tooltip'

interface CardProps {
  concept: ConceptTemplate
  selected: boolean
  onPick: (id: string) => void
}

/** One idea from the gallery: name, genre, a one-line pitch, the vision, and the cards it is built around. */
function ConceptCard({ concept, selected, onPick }: CardProps) {
  return (
    <button
      type="button"
      className={`concept-card ${selected ? 'selected' : ''}`}
      aria-pressed={selected}
      onClick={() => onPick(concept.id)}
    >
      <span className="concept-card-top">
        <span className="concept-name">{concept.title}</span>
        <span className="genre-tag">{concept.genre}</span>
      </span>
      <span className="concept-pitch">{concept.pitch}</span>
      <span className="concept-foot">
        <span className="vision">
          <i aria-hidden="true" />
          {concept.vision}
        </span>
        <span className="seed-chips" aria-label="Built around">
          {concept.seedFeatures.map((id) => (
            <span key={id} className="seed-chip">
              {featureLabel(id)}
            </span>
          ))}
        </span>
      </span>
    </button>
  )
}

interface GalleryProps {
  /** The gallery concept currently loaded in the form, if any. */
  selected: string | null
  onPick: (id: string) => void
}

/** PICK AN EXAMPLE: every concept in the gallery. Tapping one loads it into the form. */
export default function ConceptGallery({ selected, onPick }: GalleryProps) {
  return (
    <div className="gallery-wrap">
      <p className="gallery-lede">
        Tap a game to load it. You can still change anything before you start.{' '}
        <Tooltip text={HELP.seeds} className="gallery-help">
          <span className="link-like">What are the cards?</span>
        </Tooltip>
      </p>
      <ul className="gallery" aria-label="Concept gallery">
        {CONCEPTS.map((concept) => (
          <li key={concept.id}>
            <ConceptCard concept={concept} selected={selected === concept.id} onPick={onPick} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** MY FIRST GAME: three gentle ideas to choose from (the player can still rename whichever they pick). */
export function BeginnerPicks({ selected, onPick }: GalleryProps) {
  return (
    <div className="beginner-picks" role="group" aria-label="Pick your first game">
      <div className="eyebrow">PICK YOUR FIRST GAME</div>
      <ul>
        {beginnerConcepts().map((concept) => (
          <li key={concept.id}>
            <button
              type="button"
              className={`beginner-card ${selected === concept.id ? 'selected' : ''}`}
              aria-pressed={selected === concept.id}
              onClick={() => onPick(concept.id)}
            >
              <span className="concept-name">{concept.title}</span>
              <span className="genre-tag">{concept.genre}</span>
              <span className="concept-pitch">{concept.pitch}</span>
              <span className="vision">
                <i aria-hidden="true" />
                {concept.vision}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
