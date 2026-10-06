import { create } from 'zustand'
import {
  analyzeTurningPoint,
  applyAction,
  createRun,
  endSprint,
  randomSeed,
  shipGame,
} from '../engine'
import type { Action, ActionResult, Concept, RunState, TurningPoint } from '../engine'

export type Screen = 'concept' | 'game' | 'review'

interface GameStore {
  screen: Screen
  /** The concept being edited, and the one used for the next run. */
  concept: Concept
  run: RunState | null
  turningPoint: TurningPoint | null

  setConcept: (patch: Partial<Concept>) => void
  /** Start a run from the current concept. */
  startRun: () => void
  perform: (action: Action) => ActionResult
  closeSprint: () => void
  ship: () => void
  /** Same concept, brand-new seed, straight into sprint 1. */
  newRun: () => void
  /** Back to the concept screen with the last concept filled in. */
  editConcept: () => void
}

const EMPTY_CONCEPT: Concept = { title: '', idea: '', genre: 'Action' }

function conceptIsValid(c: Concept): boolean {
  return c.title.trim().length > 0 && c.idea.trim().length > 0
}

function tidy(c: Concept): Concept {
  return { ...c, title: c.title.trim(), idea: c.idea.trim() }
}

/** Route to the review screen the moment a run has shipped. */
function afterRunChanged(run: RunState): Pick<GameStore, 'run' | 'screen' | 'turningPoint'> {
  if (run.phase === 'shipped') {
    return { run, screen: 'review', turningPoint: analyzeTurningPoint(run) }
  }
  return { run, screen: 'game', turningPoint: null }
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'concept',
  concept: EMPTY_CONCEPT,
  run: null,
  turningPoint: null,

  setConcept: (patch) => set((s) => ({ concept: { ...s.concept, ...patch } })),

  startRun: () => {
    const { concept } = get()
    if (!conceptIsValid(concept)) return
    const clean = tidy(concept)
    set({ concept: clean, ...afterRunChanged(createRun(clean, randomSeed())) })
  },

  perform: (action) => {
    const { run } = get()
    if (!run) throw new Error('No run in progress')
    const result = applyAction(run, action)
    if (result.ok) set({ ...afterRunChanged(result.state) })
    return result
  },

  closeSprint: () => {
    const { run } = get()
    if (run) set({ ...afterRunChanged(endSprint(run)) })
  },

  ship: () => {
    const { run } = get()
    if (run) set({ ...afterRunChanged(shipGame(run)) })
  },

  newRun: () => {
    const { concept } = get()
    if (!conceptIsValid(concept)) {
      set({ screen: 'concept', run: null, turningPoint: null })
      return
    }
    set({ ...afterRunChanged(createRun(concept, randomSeed())) })
  },

  editConcept: () => set({ screen: 'concept', run: null, turningPoint: null }),
}))
