import { create } from 'zustand'
import {
  FULL_RUN,
  TUTORIAL_RUN,
  analyzeTurningPoint,
  applyAction,
  createRun,
  endSprint,
  randomSeed,
  shipGame,
} from '../engine'
import type { Action, ActionResult, Concept, RunConfig, RunState, TurningPoint } from '../engine'
import { addArchiveEntry, loadSave, writeSave } from '../save'
import type { SaveData, StorageLike } from '../save'
import { applyTheme } from '../themes'
import type { ThemeId } from '../themes'
import {
  EMPTY_PROGRESS,
  TUTORIAL_CONCEPT,
  advanceTutorial,
  dismissEvent,
  dismissTip,
  tutorialPassed,
} from '../tutorial/script'
import type { TutorialProgress } from '../tutorial/script'

/**
 * welcome:  first launch only. The "MY FIRST GAME" card.
 * concept:  pitch a game (prefilled for the tutorial).
 * game:     a run in progress.
 * review:   the verdict.
 */
export type Screen = 'welcome' | 'concept' | 'game' | 'review'

export interface GameStore {
  screen: Screen
  /** Everything that persists between visits. */
  save: SaveData
  /** The concept being edited, and the one used for the next run. */
  concept: Concept
  run: RunState | null
  turningPoint: TurningPoint | null
  /** What the tutorial is showing right now (always empty in the full game). */
  tutorial: TutorialProgress

  setConcept: (patch: Partial<Concept>) => void
  /** First launch: leave the welcome card for the (prefilled) tutorial concept screen. */
  beginTutorial: () => void
  /** Start a run from the current concept. The tutorial run until the tutorial is passed. */
  startRun: () => void
  perform: (action: Action) => ActionResult
  closeSprint: () => void
  ship: () => void
  /** Same concept, brand-new seed, straight into sprint 1. */
  newRun: () => void
  /** Back to the concept screen with the last concept filled in. */
  editConcept: () => void
  /** After passing the tutorial: leave the review for a blank, full-game concept screen. */
  openStudio: () => void
  setTheme: (id: ThemeId) => void
  dismissTutorialEvent: () => void
  dismissTutorialTip: () => void
}

const EMPTY_CONCEPT: Concept = { title: '', idea: '', genre: 'Action' }

function conceptIsValid(c: Concept): boolean {
  return c.title.trim().length > 0 && c.idea.trim().length > 0
}

function tidy(c: Concept): Concept {
  return { ...c, title: c.title.trim(), idea: c.idea.trim() }
}

/**
 * Build the store. The app uses one instance backed by real localStorage; tests build their
 * own with an in-memory fake so nothing leaks between them.
 */
export function createGameStore(storage?: StorageLike | null) {
  const persist = (save: SaveData) => {
    writeSave(save, storage)
  }
  const initialSave = loadSave(storage)
  const tutorialDone = initialSave.tutorialCompleted

  return create<GameStore>((set, get) => {
    /** The config the next run must use: the tutorial gates the full game. */
    const nextConfig = (): RunConfig => (get().save.tutorialCompleted ? FULL_RUN : TUTORIAL_RUN)

    /** Move to whichever screen fits the run, and record the run if it just shipped. */
    const showRun = (run: RunState) => {
      const state = get()
      if (run.phase !== 'shipped') {
        set({
          run,
          screen: 'game',
          turningPoint: null,
          tutorial: advanceTutorial(run, state.tutorial),
        })
        return
      }

      // The run just shipped: archive it, and unlock the full game if this was a passed tutorial.
      const review = run.review!
      let save = addArchiveEntry(state.save, {
        id: `${run.seed}-${run.history.length}`,
        title: run.concept.title,
        genre: run.concept.genre,
        score: review.score,
        band: review.band,
        sprint: review.shippedSprint,
        kind: run.config.kind,
        date: new Date().toISOString(),
      })
      if (run.config.kind === 'tutorial' && tutorialPassed(run)) save = { ...save, tutorialCompleted: true }
      persist(save)
      set({
        run,
        save,
        screen: 'review',
        turningPoint: analyzeTurningPoint(run),
        tutorial: advanceTutorial(run, state.tutorial),
      })
    }

    const freshRun = () => {
      const concept = tidy(get().concept)
      set({ concept, tutorial: EMPTY_PROGRESS })
      showRun(createRun(concept, randomSeed(), nextConfig()))
    }

    return {
      screen: tutorialDone ? 'concept' : 'welcome',
      save: initialSave,
      concept: tutorialDone ? EMPTY_CONCEPT : TUTORIAL_CONCEPT,
      run: null,
      turningPoint: null,
      tutorial: EMPTY_PROGRESS,

      setConcept: (patch) => set((s) => ({ concept: { ...s.concept, ...patch } })),

      beginTutorial: () => set({ screen: 'concept', concept: TUTORIAL_CONCEPT }),

      startRun: () => {
        if (!conceptIsValid(get().concept)) return
        freshRun()
      },

      perform: (action) => {
        const { run } = get()
        if (!run) throw new Error('No run in progress')
        const result = applyAction(run, action)
        if (result.ok) showRun(result.state)
        return result
      },

      closeSprint: () => {
        const { run } = get()
        if (run) showRun(endSprint(run))
      },

      ship: () => {
        const { run } = get()
        if (run) showRun(shipGame(run))
      },

      newRun: () => {
        if (!conceptIsValid(get().concept)) {
          set({ screen: 'concept', run: null, turningPoint: null })
          return
        }
        freshRun()
      },

      editConcept: () => set({ screen: 'concept', run: null, turningPoint: null, tutorial: EMPTY_PROGRESS }),

      openStudio: () =>
        set({ screen: 'concept', concept: EMPTY_CONCEPT, run: null, turningPoint: null, tutorial: EMPTY_PROGRESS }),

      setTheme: (id) => {
        const save = { ...get().save, theme: id }
        persist(save)
        set({ save })
        if (typeof document !== 'undefined') applyTheme(id)
      },

      dismissTutorialEvent: () => {
        const { run, tutorial } = get()
        if (!run) return
        set({ tutorial: advanceTutorial(run, dismissEvent(tutorial)) })
      },

      dismissTutorialTip: () => {
        const { run, tutorial } = get()
        if (!run) return
        set({ tutorial: advanceTutorial(run, dismissTip(tutorial)) })
      },
    }
  })
}

/** The app's store: real localStorage, created once. */
export const useGameStore = createGameStore()
