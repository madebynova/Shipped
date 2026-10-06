import type { FormEvent, KeyboardEvent } from 'react'
import { GENRES } from '../content/genres'
import type { Concept } from '../engine'
import { useGameStore } from './store'

const EXAMPLE: Concept = {
  title: 'Iron Pulse',
  idea: 'A brutal physics-driven hand-to-hand combat game where every hit matters.',
  genre: 'Action',
}

const MAX_TITLE = 32
const MAX_IDEA = 140

export default function ConceptScreen() {
  const concept = useGameStore((s) => s.concept)
  const setConcept = useGameStore((s) => s.setConcept)
  const startRun = useGameStore((s) => s.startRun)

  const ready = concept.title.trim().length > 0 && concept.idea.trim().length > 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ready) startRun()
  }

  const submitFromIdea = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && ready) startRun()
  }

  return (
    <div className="concept">
      <section className="hero">
        <div className="eyebrow">VERSION 0.0.1</div>
        <h1 className="logo">SHIPPED</h1>
        <p className="tagline">Make a game. Decide when to ship it.</p>
        <ul className="rules">
          <li>
            <b>8 sprints.</b> Three actions each.
          </li>
          <li>
            <b>6 features,</b> time for maybe four.
          </li>
          <li>
            <b>Ship from sprint 4,</b> or be forced at sprint 8.
          </li>
        </ul>
      </section>

      <form className="panel concept-form" onSubmit={submit}>
        <div className="form-head">
          <h2 className="eyebrow">NEW GAME CONCEPT</h2>
          <button type="button" className="link" onClick={() => setConcept(EXAMPLE)}>
            use an example
          </button>
        </div>

        <label className="field">
          <span className="field-label">GAME TITLE</span>
          <input
            type="text"
            value={concept.title}
            maxLength={MAX_TITLE}
            placeholder="Iron Pulse"
            autoFocus
            autoComplete="off"
            onChange={(e) => setConcept({ title: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field-label">
            CORE IDEA
            <em>
              {concept.idea.length}/{MAX_IDEA}
            </em>
          </span>
          <textarea
            value={concept.idea}
            maxLength={MAX_IDEA}
            rows={3}
            placeholder="A brutal physics-driven hand-to-hand combat game where every hit matters."
            onChange={(e) => setConcept({ idea: e.target.value })}
            onKeyDown={submitFromIdea}
          />
          <span className="field-hint">A specific, varied idea scores higher on ORIGINALITY.</span>
        </label>

        <fieldset className="field genres">
          <legend className="field-label">GENRE</legend>
          <div className="genre-grid" role="radiogroup" aria-label="Genre">
            {GENRES.map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={concept.genre === g.id}
                className={`genre ${concept.genre === g.id ? 'selected' : ''}`}
                onClick={() => setConcept({ genre: g.id })}
              >
                <span className="genre-name">{g.id}</span>
                <span className="genre-blurb">{g.blurb}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="cta" disabled={!ready}>
          START DEVELOPMENT
          <span>{ready ? 'sprint 1 of 8' : 'enter a title and an idea'}</span>
        </button>
      </form>
    </div>
  )
}
