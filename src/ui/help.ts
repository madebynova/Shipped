import {
  CANCEL_HYPE_PENALTY,
  CANCEL_PENALTY,
  COMPLETE_BONUS,
  COMPLETE_MIN_FEATURES,
  POLISHED_AT,
  PROMISE_HURT_CAP,
  RELEASE_WINDOW,
  SLOTS_PER_SPRINT,
} from '../engine'
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

  // --- the concept gallery -----------------------------------------------------------------
  seeds: `The two or three feature cards a game is built around. They are what the pitch promises: a card that is missing at launch becomes a promise to finish later.`,
  promises: `The features your pitch promises. They change nothing about your launch score. After launch, a promised feature you never built hurts your legacy score a little more every sprint (up to ${PROMISE_HURT_CAP} points) until you build it or cancel it.`,

  // --- after launch --------------------------------------------------------------------------
  revenue: (income: number, upkeep: number) =>
    `Your revenue account: what the game has earned. Each sprint sales add about ${formatMoney(income)} (and fade) and the team costs ${formatMoney(upkeep)}. If it cannot cover the next sprint you get one warning sprint, then the studio closes.`,
  runway: `How many more sprints the account can pay for if nothing new happens: no releases, no events. Sales keep fading, so it is a countdown, not a promise.`,
  buzz: `Hype after launch is buzz. It lifts the money coming in, fades by itself every sprint, and makes a release sell harder. A good game rides it up; a rough one is judged harder for it.`,
  liveTrack: `Live sprints have no deadline. An update window opens every ${RELEASE_WINDOW} sprints: release in the window for the full sales boost, or earlier for a smaller one.`,
  launchScore: `Your review at launch. It is your first impression, it is saved in the archive for good, and nothing you do now can change it.`,
  legacyScore: `How good the game is NOW: the review formula re-run on today's build, minus a little for each broken promise, with a bonus for a COMPLETE game. It can go up or down. Hover the numbers for the arithmetic.`,
  release: `Publish an update: patch notes, a new legacy score and a boost to your sales. It costs no action slot and nothing extra. An update with nothing new in it earns nothing.`,
  retire: `End the run and write the final legacy card. Your launch score stays as it was. You can retire at any time.`,
  cancelPromise: `Formally cancel an unbuilt promise. It stops hurting every sprint, but it costs ${CANCEL_PENALTY} legacy points for good and ${CANCEL_HYPE_PENALTY} hype, and that feature can never be built.`,
  complete: `COMPLETE: at least ${COMPLETE_MIN_FEATURES} features built, every one POLISHED, no bugs, every promise kept and none cancelled. It earns a stamp and ${COMPLETE_BONUS} legacy points.`,
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
  {
    title: 'After launch',
    entries: [
      { term: 'Live updates', text: 'After shipping a full game you can keep developing it, paid for by sales. Same three slots, same five actions.' },
      { term: 'Launch score', text: 'Your review at launch. Permanent: it stays in the archive whatever you do next.' },
      { term: 'Legacy score', text: 'How good the game is now. It moves as you fix, polish and build, and it is recorded next to the launch score.' },
      { term: 'Revenue', text: 'Sales fill the account, upkeep drains it, and sales fade every sprint unless a release brings a new spike.' },
      { term: 'Release', text: 'Publish an update: patch notes, a legacy score and a sales spike. Best once the update window opens (every 4 sprints).' },
      { term: 'Promises', text: 'Features your pitch promised but you never built. They hurt your legacy score each sprint until you build or cancel them.' },
      { term: 'COMPLETE', text: 'Every feature POLISHED, no bugs and every promise kept. A special stamp and a bonus to the legacy score.' },
      { term: 'Retire', text: 'End the run and write the final card. Run out of money and the studio closes, after one warning sprint.' },
    ],
  },
]
