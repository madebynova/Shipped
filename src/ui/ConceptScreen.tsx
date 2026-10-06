import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { MAX_IDEA, MAX_TITLE } from '../content/concepts'
import { GENRES } from '../content/genres'
import { TOTAL_SPRINTS, TUTORIAL_PASS_SCORE, TUTORIAL_RUN, promisedFeatures } from '../engine'
import Archive from './Archive'
import ConceptGallery, { BeginnerPicks } from './ConceptGallery'
import { featureLabel } from './format'
import { HELP } from './help'
import { DeckIcon, DiceIcon, PencilIcon } from './icons'
import { useGameStore } from './store'
import Tooltip from './Tooltip'

/** Where the concept in the form came from. It only decides which option is lit up. */
type Source = 'example' | 'random' | 'own'

export default function ConceptScreen() {
  const concept = useGameStore((s) => s.concept)
  const conceptId = useGameStore((s) => s.conceptId)
  const setConcept = useGameStore((s) => s.setConcept)
  const pickConcept = useGameStore((s) => s.pickConcept)
  const rollConcept = useGameStore((s) => s.rollConcept)
  const writeOwnConcept = useGameStore((s) => s.writeOwnConcept)
  const startRun = useGameStore((s) => s.startRun)
  const save = useGameStore((s) => s.save)

  // Until the tutorial is passed, every run is "MY FIRST GAME".
  const tutorial = !save.tutorialCompleted
  const ready = concept.title.trim().length > 0 && concept.idea.trim().length > 0

  // The three options. WRITE MY OWN is the form exactly as it always was, so it is the default.
  const [source, setSource] = useState<Source>(conceptId ? 'example' : 'own')
  const [view, setView] = useState<'gallery' | 'form'>('form')

  const openGallery = () => {
    setSource('example')
    setView('gallery')
  }
  const roll = () => {
    rollConcept()
    setSource('random')
    setView('form')
  }
  const writeOwn = () => {
    writeOwnConcept()
    setSource('own')
    setView('form')
  }
  const pickFromGallery = (id: string) => {
    pickConcept(id)
    setSource('example')
    setView('form')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ready && view === 'form') startRun()
  }

  const submitFromIdea = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && ready) startRun()
  }

  const promised = promisedFeatures(concept)

  return (
    <div className="concept">
      <section className="hero">
        <div className="eyebrow">{tutorial ? 'MY FIRST GAME' : 'VERSION 0.0.3'}</div>
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
            <li>
              <b>Then retire it,</b> or keep it alive with updates.
            </li>
          </ul>
        )}
        {tutorial && <BeginnerPicks selected={conceptId} onPick={pickConcept} />}
        <Archive entries={save.archive} />
      </section>

      <form className="panel concept-form" onSubmit={submit}>
        <div className="form-head">
          <h2 className="eyebrow">{tutorial ? 'NAME YOUR FIRST GAME' : 'NEW GAME CONCEPT'}</h2>
          {!tutorial && source === 'random' && view === 'form' && (
            <button type="button" className="link" onClick={roll}>
              roll again
            </button>
          )}
        </div>

        {!tutorial && (
          <div className="mode-tabs" role="group" aria-label="How do you want to start?">
            <button type="button" className={`mode-tab ${source === 'example' ? 'on' : ''}`} aria-pressed={source === 'example'} onClick={openGallery}>
              <DeckIcon />
              <span>PICK AN EXAMPLE</span>
            </button>
            <button type="button" className={`mode-tab ${source === 'random' ? 'on' : ''}`} aria-pressed={source === 'random'} onClick={roll}>
              <DiceIcon />
              <span>ROLL RANDOM</span>
            </button>
            <button type="button" className={`mode-tab ${source === 'own' ? 'on' : ''}`} aria-pressed={source === 'own'} onClick={writeOwn}>
              <PencilIcon />
              <span>WRITE MY OWN</span>
            </button>
          </div>
        )}

        {view === 'gallery' && !tutorial ? (
          <>
            <ConceptGallery selected={conceptId} onPick={pickFromGallery} />
            {ready && (
              <button type="button" className="link back-link" onClick={() => setView('form')}>
                back to my concept
              </button>
            )}
          </>
        ) : (
          <>
            {concept.vision && !tutorial && (
              <div className="loaded">
                <div className="loaded-line">
                  <span className="eyebrow">VISION</span>
                  <span className="vision-text">{concept.vision}</span>
                </div>
                {(concept.seedFeatures?.length ?? 0) > 0 && (
                  <div className="loaded-line">
                    <Tooltip text={HELP.seeds}>
                      <span className="eyebrow">BUILT AROUND</span>
                    </Tooltip>
                    <span className="seed-chips">
                      {concept.seedFeatures!.map((id) => (
                        <span key={id} className="seed-chip">
                          {featureLabel(id)}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            )}

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

            {!tutorial && (
              <p className="promise-hint">
                <Tooltip text={HELP.promises}>
                  <span className="eyebrow">YOUR PITCH PROMISES</span>
                </Tooltip>
                <span>{promised.map(featureLabel).join(' · ')}</span>
              </p>
            )}

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
          </>
        )}
      </form>
    </div>
  )
}
