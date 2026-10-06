import { POLISHED_AT, SLOTS_PER_SPRINT } from '../engine'
import { formatMoney } from './format'

// The help layer is passive: tooltips and a glossary. It explains, it never nags.
// Same friendly voice as the rest of the game: what it is, what moves it, why it matters.

export const HELP = {
  money: (upkeep: number) =>
    `Your cash. Closing a sprint costs ${formatMoney(upkeep)} right now, and a bigger game costs more to run. Hit zero and the team works unpaid: slower, buggier and cranky.`,
  morale: `How the team feels. Building wears it down, REST brings it back. A tired team builds weaker work; a burned-out one builds buggy work.`,
  hype: `How much the world expects from your game. HYPE raises it. A strong game rides high expectations to a better review; a weak one gets punished for them.`,
  bugs: `Known problems in the build. Building and a big game create them; FIX and POLISH remove them. Every bug drags down GAMEPLAY, CONTENT and POLISH in the review.`,
  sprint: (total: number) =>
    `A chunk of development time. You get ${SLOTS_PER_SPRINT} actions per sprint, and the game ships for good when sprint ${total} ends.`,
  scope: `How big your game has grown. Bigger scope means slower builds, weaker fixes, bugs that appear on their own, and a higher upkeep bill each sprint.`,
  slots: `Each sprint gives you ${SLOTS_PER_SPRINT} action slots. Every action costs one. You can't do everything, and that's the game.`,
  complexity: `How big a feature is. Complex features take more builds and add more scope, but give a richer game.`,
  quality: `How good a built feature is, out of 100. At ${POLISHED_AT}+ it earns the gold POLISHED badge. POLISH it, or rework it with BUILD (faster, but messier).`,
  progress: `Build progress. When the bar fills, the feature becomes PLAYABLE.`,
  shipLocked: `You can't ship until sprint 4: you need something worth shipping first.`,
  shipOpen: `Ships the game as it stands and starts the review. No undo.`,
  endHint: `What happens when you close the sprint: upkeep is paid and any bugs that creep in on their own are added.`,
} as const

export interface GlossaryEntry {
  term: string
  text: string
}

export interface GlossaryGroup {
  title: string
  entries: GlossaryEntry[]
}

export const GLOSSARY: GlossaryGroup[] = [
  {
    title: 'Resources',
    entries: [
      { term: 'Money', text: 'Your runway. Each sprint costs upkeep, which grows with scope. At zero the team works unpaid.' },
      { term: 'Morale', text: 'Building drains it, REST restores it. Low morale means weaker, buggier work.' },
      { term: 'Hype', text: 'Expectations. It only matters at the end: good games gain from it, weak games lose.' },
      { term: 'Bugs', text: 'Problems in the build. They lower your review score until you FIX them.' },
    ],
  },
  {
    title: 'Actions',
    entries: [
      { term: 'BUILD', text: 'Move a feature toward PLAYABLE, or rework a built one for fast (but messy) quality. Adds bugs and scope.' },
      { term: 'POLISH', text: 'Raise a built feature’s quality and smooth off a bug. Slower than a rework, but clean.' },
      { term: 'FIX', text: 'Remove bugs. Builds nothing.' },
      { term: 'HYPE', text: 'Raise hype. Improves nothing about the game itself.' },
      { term: 'REST', text: 'Recover morale. Builds nothing.' },
    ],
  },
  {
    title: 'Systems',
    entries: [
      { term: 'Scope', text: 'How big the game has grown (LOW to CRITICAL). Bigger means slower, buggier and costlier.' },
      { term: 'Quality', text: `Each built feature has a quality out of 100. ${POLISHED_AT}+ is POLISHED.` },
      { term: 'Complexity', text: 'How much a feature costs to build and how much scope it adds.' },
      { term: 'Shipping', text: 'Open from sprint 4. When the last sprint ends the game ships whether you are ready or not.' },
      { term: 'Review', text: 'Gameplay, Content, Polish and Originality, then a hype modifier. The Turning Point shows the decision that mattered most.' },
    ],
  },
]
