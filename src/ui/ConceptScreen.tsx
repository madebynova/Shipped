import type { FormEvent, KeyboardEvent } from 'react'
import { GENRES } from '../content/genres'
import { TUTORIAL_PASS_SCORE, TUTORIAL_RUN, TOTAL_SPRINTS } from '../engine'
import type { Concept } from '../engine'
import Archive from './Archive'
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
  const save = useGameStore((s) => s.save)

  // Until the tutorial is passed, every run is "MY FIRST GAME".
  const tutorial = !save.tutorialCompleted
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
        <div className="eyebrow">{tutorial ? 'MY FIRST GAME' : 'VERSION 0.0.2'}</div>
        <h1 className="logo">SHIPPED</h1>
        <p className="tagline">Make a game. Decide when to ship it.</p>
        {tutorial ? (
          <ul className="rules">
            <li>
              <b>{TUTORIAL_RUN.totalSprints} sprints.</b> Three actions each.
            </li>
            <li>
              <b>{TUTORIAL_RUN.featureIds?.length} feature cards,</b> and the team to guide you.
            </li>
            <li>
              <b>Ship with {TUTORIAL_PASS_SCORE}+</b> to open your studio.
            </li>
          </ul>
        ) : (
          <ul className="rules">
            <li>
              <b>{TOTAL_SPRINTS} sprints.</b> Three actions each.
            </li>
            <li>
              <b>6 features,</b> time for maybe four.
            </li>
            <li>
              <b>Ship from sprint 4,</b> or be forced at sprint {TOTAL_SPRINTS}.
            </li>
          </ul>
        )}
        <Archive entries={save.archive} />
      </section>

      <form className="panel concept-form" onSubmit={submit}>
        <div className="form-head">
          <h2 className="eyebrow">{tutorial ? 'NAME YOUR FIRST GAME' : 'NEW GAME CONCEPT'}</h2>
          {!tutorial && (
            <button type="button" className="link" onClick={() => setConcept(EXAMPLE)}>
              use an example
            </button>
          )}
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
          {tutorial ? 'START MY FIRST GAME' : 'START DEVELOPMENT'}
          <span>
            {ready
              ? tutorial
                ? `${TUTORIAL_RUN.totalSprints} sprints · pass with ${TUTORIAL_PASS_SCORE}+`
                : `sprint 1 of ${TOTAL_SPRINTS}`
              : 'enter a title and an idea'}
          </span>
        </button>
      </form>
    </div>
  )
}
