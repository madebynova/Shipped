import { create } from 'zustand'
import { CONCEPTS, beginnerConcepts, conceptFromTemplate, findConcept, rollConcept } from '../content/concepts'
import {
  FULL_RUN,
  TUTORIAL_RUN,
  analyzeTurningPoint,
  applyAction,
  cancelPromise,
  computeLegacy,
  createRun,
  endSprint,
  launchUpdates,
  randomSeed,
  releaseUpdate,
  resolveEvent,
  retireGame,
  shipGame,
} from '../engine'
import type { Action, ActionResult, Concept, FeatureId, Release, RunConfig, RunState, TurningPoint } from '../engine'
import { addArchiveEntry, loadSave, updateArchiveLegacy, writeSave } from '../save'
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
 * game:     a run in progress, before launch (developing) or after it (live updates).
 * review:   the launch verdict, and the choice between LAUNCH UPDATES and RETIRE GAME.
 * legacy:   the final card, written when a game is retired.
 */
export type Screen = 'welcome' | 'concept' | 'game' | 'review' | 'legacy'

export interface GameStore {
  screen: Screen
  /** Everything that persists between visits. */
  save: SaveData
  /** The concept being edited, and the one used for the next run. */
  concept: Concept
  /** The gallery concept the form was loaded from, if any. It highlights that card; WRITE MY OWN clears it. */
  conceptId: string | null
  run: RunState | null
  turningPoint: TurningPoint | null
  /** What the tutorial is showing right now (always empty in the full game). */
  tutorial: TutorialProgress
  /** The update that was just published. Its patch notes show until the player dismisses them. */
  lastRelease: Release | null

  setConcept: (patch: Partial<Concept>) => void
  /** PICK AN EXAMPLE: load a gallery concept into the form (still editable). */
  pickConcept: (id: string) => void
  /** ROLL RANDOM: load a random gallery concept into the form. Never the one already there. */
  rollConcept: () => void
  /** WRITE MY OWN: keep the text, but let go of the gallery concept's seed features and vision. */
  writeOwnConcept: () => void
  /** First launch: leave the welcome card for the (prefilled) tutorial concept screen. */
  beginTutorial: () => void
  /** Start a run from the current concept. The tutorial run until the tutorial is passed. */
  startRun: () => void
  perform: (action: Action) => ActionResult
  closeSprint: () => void
  ship: () => void
  /** After shipping a full game: keep developing it (LIVE UPDATES). */
  launchUpdates: () => void
  /** End the run now and write the final legacy card. */
  retire: () => void
  /** Publish an update: patch notes, a sales spike and a new legacy score. */
  release: () => void
  dismissRelease: () => void
  /** Formally cancel a promised feature that was never built. */
  cancelPromise: (id: FeatureId) => void
  /** Choose one of the options of the live event that is waiting. */
  decideEvent: (choiceId: string) => void
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

/** The id of the gallery concept the tutorial starts on (Lantern Hollow, as in v0.0.2). */
const TUTORIAL_CONCEPT_ID = beginnerConcepts()[0].id

/**
 * Build the store. The app uses one instance backed by real localStorage; tests build their
 * own with an in-memory fake (and a fixed "random" function) so nothing leaks between them.
 */
export function createGameStore(storage?: StorageLike | null, random: () => number = Math.random) {
  const persist = (save: SaveData) => {
    writeSave(save, storage)
  }
  const initialSave = loadSave(storage)
  const tutorialDone = initialSave.tutorialCompleted

  return create<GameStore>((set, get) => {
    /** The config the next run must use: the tutorial gates the full game. */
    const nextConfig = (): RunConfig => (get().save.tutorialCompleted ? FULL_RUN : TUTORIAL_RUN)

    /** The archive entry of the run being played (set when it ships), so updates can find it again. */
    let archiveId: string | null = null

    /** Write where a live or retired game's reputation stands into the archive. The launch score is never touched. */
    const recordLegacy = (save: SaveData, run: RunState): SaveData => {
      if (!archiveId) return save
      const legacy = run.legacy ?? computeLegacy(run)
      return updateArchiveLegacy(save, archiveId, {
        legacyScore: legacy.score,
        legacyBand: legacy.band,
        complete: legacy.complete,
      })
    }

    /** Move to whichever screen fits the run, and record the run in the archive when it ships or ends. */
    const showRun = (run: RunState) => {
      const state = get()

      if (run.phase === 'developing' || run.phase === 'live') {
        set({
          run,
          screen: 'game',
          turningPoint: null,
          tutorial: advanceTutorial(run, state.tutorial),
        })
        return
      }

      if (run.phase === 'retired') {
        const save = recordLegacy(state.save, run)
        persist(save)
        set({ run, save, screen: 'legacy', turningPoint: null, tutorial: EMPTY_PROGRESS })
        return
      }

      // The run just shipped: archive it, and unlock the full game if this was a passed tutorial.
      const review = run.review!
      archiveId = `${run.seed}-${run.history.length}`
      let save = addArchiveEntry(state.save, {
        id: archiveId,
        title: run.concept.title,
        genre: run.concept.genre,
        score: review.score,
        band: review.band,
        sprint: review.shippedSprint,
        kind: run.config.kind,
        date: new Date().toISOString(),
        // Until updates change it, a game's legacy is its launch score.
        legacyScore: review.score,
        legacyBand: review.band,
        complete: false,
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
      archiveId = null
      set({ concept, tutorial: EMPTY_PROGRESS, lastRelease: null })
      showRun(createRun(concept, randomSeed(), nextConfig()))
    }

    /** Which gallery concepts the player may pick: everything, or only the gentle ones during MY FIRST GAME. */
    const pool = () => (get().save.tutorialCompleted ? CONCEPTS : beginnerConcepts())

    const load = (id: string) => {
      const template = findConcept(id)
      if (!template || !pool().some((c) => c.id === template.id)) return
      set({ concept: conceptFromTemplate(template), conceptId: template.id })
    }

    return {
      screen: tutorialDone ? 'concept' : 'welcome',
      save: initialSave,
      concept: tutorialDone ? EMPTY_CONCEPT : TUTORIAL_CONCEPT,
      conceptId: tutorialDone ? null : TUTORIAL_CONCEPT_ID,
      run: null,
      turningPoint: null,
      tutorial: EMPTY_PROGRESS,
      lastRelease: null,

      setConcept: (patch) => set((s) => ({ concept: { ...s.concept, ...patch } })),

      pickConcept: (id) => load(id),

      rollConcept: () => load(rollConcept(pool(), random, get().conceptId).id),

      writeOwnConcept: () =>
        set((s) => ({ concept: { ...s.concept, seedFeatures: undefined, vision: undefined }, conceptId: null })),

      beginTutorial: () => set({ screen: 'concept', concept: TUTORIAL_CONCEPT, conceptId: TUTORIAL_CONCEPT_ID }),

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

      // Each of these asks the engine to do something. If the engine says no it hands back the very same
      // state, and then nothing must happen (in particular a shipped game must not be archived twice).
      closeSprint: () => {
        const { run } = get()
        if (!run) return
        const next = endSprint(run)
        if (next !== run) showRun(next)
      },

      ship: () => {
        const { run } = get()
        if (!run) return
        const next = shipGame(run)
        if (next !== run) showRun(next)
      },

      launchUpdates: () => {
        const { run } = get()
        if (!run) return
        const next = launchUpdates(run)
        if (next !== run) showRun(next)
      },

      retire: () => {
        const { run } = get()
        if (!run) return
        const next = retireGame(run)
        if (next !== run) showRun(next)
      },

      release: () => {
        const { run } = get()
        if (!run) return
        const next = releaseUpdate(run)
        if (next === run) return
        const save = recordLegacy(get().save, next)
        persist(save)
        set({ save, lastRelease: next.live!.releases[next.live!.releases.length - 1] })
        showRun(next)
      },

      dismissRelease: () => set({ lastRelease: null }),

      cancelPromise: (id) => {
        const { run } = get()
        if (!run) return
        const next = cancelPromise(run, id)
        if (next === run) return
        const save = recordLegacy(get().save, next)
        persist(save)
        set({ save })
        showRun(next)
      },

      decideEvent: (choiceId) => {
        const { run } = get()
        if (!run) return
        const next = resolveEvent(run, choiceId)
        if (next !== run) showRun(next)
      },

      newRun: () => {
        if (!conceptIsValid(get().concept)) {
          set({ screen: 'concept', run: null, turningPoint: null, lastRelease: null })
          return
        }
        freshRun()
      },

      editConcept: () =>
        set({ screen: 'concept', run: null, turningPoint: null, tutorial: EMPTY_PROGRESS, lastRelease: null }),

      openStudio: () =>
        set({
          screen: 'concept',
          concept: EMPTY_CONCEPT,
          conceptId: null,
          run: null,
          turningPoint: null,
          tutorial: EMPTY_PROGRESS,
          lastRelease: null,
        }),

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
