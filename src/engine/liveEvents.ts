import { EVENT_CHANCE, EVENT_COOLDOWN, MAX_HYPE } from './config'
import { computeLegacy } from './legacy'
import { clampMorale } from './morale'
import { cancelPromise, restartPromiseClock, unresolvedPromises } from './promises'
import { nextFloat, pickOne } from './rng'
import { addLog, findFeature } from './state'
import type { FeatureId, LiveState, RunState } from './types'

// LIVE EVENTS: things that happen to a game after launch. At the start of a live sprint there is a
// chance one of these asks the player a question. They only exist after launch, and every choice has
// a price: money, morale, hype, bugs, or the future of your sales.
//
// An event is just data (what it says, when it can happen) plus one small function per choice. To add
// an event, add one object to LIVE_EVENTS. Which event comes up is picked with the run's seeded RNG, so
// replaying the same history gives the same events.

export interface LiveEventChoice {
  id: string
  label: string
  /** One short line telling the player what this really does. */
  hint: string
  /** Money this choice costs. It is taken out of the revenue account, and the choice is locked if the account is short. */
  cost?: number
  /** Everything else this choice does. (The cost is already paid when this runs.) */
  apply: (state: RunState) => RunState
  /** What happened, for the activity log. */
  result: string
}

export interface LiveEventDef {
  id: string
  kicker: string
  title: string
  body: (state: RunState) => string[]
  /** Can this event happen right now? */
  when: (state: RunState) => boolean
  /** True for events that only ever happen once in a run. */
  once?: boolean
  choices: LiveEventChoice[]
}

interface Deltas {
  hype?: number
  bugs?: number
  morale?: number
  /** A change to sales per sprint (not to cash). */
  sales?: number
}

/** Change a few numbers at once, keeping each inside its legal range. */
function adjust(state: RunState, d: Deltas): RunState {
  const live = state.live
  return {
    ...state,
    hype: Math.max(0, Math.min(MAX_HYPE, state.hype + (d.hype ?? 0))),
    bugs: Math.max(0, state.bugs + (d.bugs ?? 0)),
    morale: clampMorale(state.morale + (d.morale ?? 0)),
    live: live && d.sales !== undefined ? { ...live, sales: Math.max(0, Math.round(live.sales + d.sales)) } : live,
  }
}

function scaleSales(state: RunState, factor: number): RunState {
  const live = state.live
  return live ? { ...state, live: { ...live, sales: Math.max(0, Math.round(live.sales * factor)) } } : state
}

function withLive(state: RunState, patch: Partial<LiveState>): RunState {
  return state.live ? { ...state, live: { ...state.live, ...patch } } : state
}

const nameOf = (state: RunState, id: FeatureId) => findFeature(state, id)?.name ?? id

export const LIVE_EVENTS: readonly LiveEventDef[] = [
  {
    id: 'modders',
    kicker: 'COMMUNITY',
    title: 'Modders fixed your bug',
    when: (s) => s.bugs >= 3,
    body: (s) => [
      `A modder called Pixelwitch posted a patch. It fixes a crash you had been putting off, and it adds a wall-jump nobody asked for.`,
      `Players are already using it. You have ${s.bugs} known bugs. Official or not, their fix is in your game now.`,
    ],
    choices: [
      {
        id: 'embrace',
        label: 'EMBRACE THE MOD',
        hint: 'Originality +4 for good, 2 fewer bugs, hype +8. Goes in the next patch notes.',
        apply: (s) => {
          const live = s.live!
          const done = adjust(s, { bugs: -2, hype: 8 })
          return withLive(done, {
            originalityBonus: live.originalityBonus + 4,
            pendingNotes: [...live.pendingNotes, "Added the community wall-jump mod as an official feature"],
          })
        },
        result: 'You credit the modders and ship their patch. The community loves it. Originality is up.',
      },
      {
        id: 'patch',
        label: 'PATCH IT YOURSELF',
        hint: 'Costs $30. 4 fewer bugs, morale -3.',
        cost: 30,
        apply: (s) => adjust(s, { bugs: -4, morale: -3 }),
        result: 'Your team re-fixes it properly. Cleaner code, grumpier team.',
      },
    ],
  },
  {
    id: 'streamer',
    kicker: 'SPOTLIGHT',
    title: 'A streamer found your game',
    when: (s) => s.live !== null && s.live.sprintsLive >= 2 && computeLegacy(s).score >= 50,
    body: (s) => [
      `A streamer with a very loud chair is playing ${s.concept.title}. Chat keeps typing the same three words and none of them are "this is bad".`,
      'Viewers are checking the store page. A little push could turn watchers into buyers.',
    ],
    choices: [
      {
        id: 'thanks',
        label: 'SEND A THANK-YOU',
        hint: 'Free. Hype +12, a small sales boost.',
        apply: (s) => adjust(s, { hype: 12, sales: Math.round(computeLegacy(s).score / 10) }),
        result: 'A friendly message goes out. The streamer reads it on air.',
      },
      {
        id: 'sponsor',
        label: 'SPONSOR THE STREAM',
        hint: 'Costs $40. Hype +25, double the sales boost.',
        cost: 40,
        apply: (s) => adjust(s, { hype: 25, sales: Math.round(computeLegacy(s).score / 5) }),
        result: 'Your logo is on screen for three hours. The store page has a very good evening.',
      },
    ],
  },
  {
    id: 'demand',
    kicker: 'COMMUNITY',
    title: 'Fans want the feature you cut',
    when: (s) => s.live !== null && s.live.sprintsLive >= 2 && unresolvedPromises(s).length > 0,
    body: (s) => {
      const name = nameOf(s, unresolvedPromises(s)[0]).toUpperCase()
      return [
        `The forums have a thread called "WHERE IS ${name}". It has 400 replies and one very good meme.`,
        'You promised it in the pitch. Fans are asking what happened to it.',
      ]
    },
    choices: [
      {
        id: 'reassure',
        label: "SAY IT'S COMING",
        hint: "Restarts that promise's clock. Hype +6, morale -2.",
        apply: (s) => restartPromiseClock(adjust(s, { hype: 6, morale: -2 }), unresolvedPromises(s)[0]),
        result: 'You post a roadmap with a date on it. The date is optimistic.',
      },
      {
        id: 'cancel',
        label: 'CANCEL IT FOR GOOD',
        hint: 'Costs 2 legacy points and 10 hype for good. The promise stops hurting every sprint.',
        // record = false: the 'choice' history entry already covers this, so replays stay consistent
        apply: (s) => cancelPromise(s, unresolvedPromises(s)[0], false),
        result: 'You post the honest version. It is not popular, but it is clear.',
      },
      {
        id: 'quiet',
        label: 'STAY QUIET',
        hint: 'Hype -5. The promise keeps getting older.',
        apply: (s) => adjust(s, { hype: -5 }),
        result: 'You say nothing. The thread grows.',
      },
    ],
  },
  {
    id: 'sale',
    kicker: 'STOREFRONT',
    title: 'A seasonal sale is coming',
    when: (s) => s.live !== null && s.live.sprintsLive >= 2,
    body: () => [
      'The storefront is running a seasonal sale and your game is on the shortlist.',
      'A discount sells copies now. It also teaches players to wait for the next discount.',
    ],
    choices: [
      {
        id: 'join',
        label: 'JOIN THE SALE',
        hint: "Cash now: another sprint of sales plus $20. Hype -5.",
        apply: (s) => {
          const live = s.live!
          const extra = live.sales + 20
          return withLive(adjust({ ...s, money: s.money + extra }, { hype: -5 }), { totalSales: live.totalSales + extra })
        },
        result: 'The discount banner goes up. The money comes in, the "wait for a sale" posts follow.',
      },
      {
        id: 'hold',
        label: 'KEEP THE PRICE',
        hint: 'Nothing happens, and fans respect it. Hype +3.',
        apply: (s) => adjust(s, { hype: 3 }),
        result: 'You keep the price. A few fans make a point of saying thank you.',
      },
    ],
  },
  {
    id: 'rival',
    kicker: 'MARKET',
    title: 'A rival announces a sequel',
    once: true,
    when: (s) => s.live !== null && s.live.sprintsLive >= 3,
    body: () => [
      'A much bigger studio just announced the sequel to a game a lot like yours. Their trailer has a helicopter. Yours has a menu.',
      'Some of your players are already asking if you can do that too.',
    ],
    choices: [
      {
        id: 'outshine',
        label: 'OUTSHINE THEM',
        hint: 'Costs $40. Hype +12, and sales only fall 5%.',
        cost: 40,
        apply: (s) => scaleSales(adjust(s, { hype: 12 }), 0.95),
        result: 'You put out a trailer of your own. It has a helicopter.',
      },
      {
        id: 'hold',
        label: 'HOLD THE LINE',
        hint: 'Free. Sales fall 18% as players wander off.',
        apply: (s) => scaleSales(s, 0.82),
        result: 'You keep your head down. Some players do not come back.',
      },
      {
        id: 'challenge',
        label: 'CHALLENGE THEM',
        hint: 'Risky. Legacy 70+: hype +15. Anything lower: sales fall 25%.',
        apply: (s) => (computeLegacy(s).score >= 70 ? adjust(s, { hype: 15 }) : scaleSales(s, 0.75)),
        result: 'You post a bold comparison and wait to see who laughs.',
      },
    ],
  },
  {
    id: 'burnout',
    kicker: 'THE TEAM',
    title: 'The team is running on fumes',
    when: (s) => s.live !== null && s.morale <= 45,
    body: (s) => [
      `Morale is ${s.morale}. Someone fell asleep in the stand-up. Someone else fell asleep during the sentence "we should do a retro".`,
      'A tired team makes slower, buggier work.',
    ],
    choices: [
      {
        id: 'retreat',
        label: 'TEAM RETREAT',
        hint: 'Costs $35. Morale +22.',
        cost: 35,
        apply: (s) => adjust(s, { morale: 22 }),
        result: 'Three days by a lake. Nobody is allowed to say the word "sprint".',
      },
      {
        id: 'push',
        label: 'PUSH THROUGH',
        hint: 'Free. Morale -6, and 2 new bugs.',
        apply: (s) => adjust(s, { morale: -6, bugs: 2 }),
        result: 'The team pushes on. The code shows it.',
      },
    ],
  },
  {
    id: 'rereview',
    kicker: 'PRESS',
    title: 'A critic gave it a second look',
    when: (s) => s.live !== null && s.live.releases.length > 0 && computeLegacy(s).score >= s.live.launchScore + 6,
    body: (s) => [
      `A critic who was lukewarm about the launch tried the latest version of ${s.concept.title}. They wrote: "I owe this game an apology."`,
      'It is the nicest sentence anyone has said about your game this month.',
    ],
    choices: [
      {
        id: 'shout',
        label: 'PUT IT ON THE STORE PAGE',
        hint: 'Free. Hype +18, a sales boost.',
        apply: (s) => adjust(s, { hype: 18, sales: Math.round(computeLegacy(s).score / 8) }),
        result: 'The quote goes on the store page in large letters.',
      },
      {
        id: 'humble',
        label: 'STAY HUMBLE',
        hint: 'Free. Hype +8, morale +3.',
        apply: (s) => adjust(s, { hype: 8, morale: 3 }),
        result: 'You forward it to the team and say nothing in public. Everyone is a little taller.',
      },
    ],
  },
  {
    id: 'driver',
    kicker: 'TECH',
    title: 'A driver update broke your game',
    when: (s) => s.live !== null && s.live.sprintsLive >= 2,
    body: () => [
      'A graphics driver update just made your menu render upside down. It is not your fault. It is, however, your problem.',
      'Players are posting screenshots. Some of them are funny.',
    ],
    choices: [
      {
        id: 'hotfix',
        label: 'HOTFIX IT NOW',
        hint: 'Costs $30. No lasting damage.',
        cost: 30,
        apply: (s) => s,
        result: 'A one-line fix goes out before lunch. The screenshots stop.',
      },
      {
        id: 'wait',
        label: 'WAIT FOR THE DRIVER',
        hint: 'Free. 3 new bugs, hype -5.',
        apply: (s) => adjust(s, { bugs: 3, hype: -5 }),
        result: 'You wait for the driver makers to fix it. They take a while.',
      },
    ],
  },
]

export function findLiveEvent(id: string | null): LiveEventDef | undefined {
  return id ? LIVE_EVENTS.find((e) => e.id === id) : undefined
}

/** Has this event been seen too recently (or, for one-off events, at all)? */
function unavailable(live: LiveState, event: LiveEventDef): boolean {
  const seen = live.eventHistory.filter((h) => h.id === event.id)
  if (event.once && seen.length > 0) return true
  return seen.some((h) => live.sprintsLive - h.sprint < EVENT_COOLDOWN)
}

/**
 * At the start of a live sprint: roll the dice, and maybe pick an event that fits the situation.
 * Uses the run's seeded RNG, so the same history always brings the same events.
 */
export function maybeStartEvent(state: RunState): RunState {
  const live = state.live
  if (!live || live.pendingEvent) return state

  const roll = nextFloat(state.rng)
  const next: RunState = { ...state, rng: roll.state }
  if (roll.value >= EVENT_CHANCE) return next

  const eligible = LIVE_EVENTS.filter((e) => e.when(next) && !unavailable(live, e))
  if (eligible.length === 0) return next

  const pick = pickOne(next.rng, eligible)
  const started: RunState = {
    ...next,
    rng: pick.state,
    live: {
      ...live,
      pendingEvent: pick.value.id,
      eventHistory: [...live.eventHistory, { id: pick.value.id, sprint: live.sprintsLive }],
    },
  }
  return addLog(started, `Something is happening: ${pick.value.title}.`, 'warn')
}

/** Why a choice cannot be taken right now, or null if it can. */
export function whyCannotChoose(state: RunState, choiceId: string): string | null {
  const event = findLiveEvent(state.live?.pendingEvent ?? null)
  if (!state.live || !event) return 'There is no event to decide.'
  const choice = event.choices.find((c) => c.id === choiceId)
  if (!choice) return 'That is not one of the choices.'
  if (choice.cost && state.money < choice.cost) return `You need $${choice.cost} in the account for this.`
  return null
}

/** Take one of the pending event's choices. Returns the unchanged state if it is not allowed. */
export function resolveEvent(state: RunState, choiceId: string): RunState {
  if (whyCannotChoose(state, choiceId) !== null) return state
  const live = state.live!
  const event = findLiveEvent(live.pendingEvent)!
  const choice = event.choices.find((c) => c.id === choiceId)!

  // The event is cleared and the cost paid first, so the choice's own function only has to do the rest.
  const cleared: RunState = {
    ...state,
    money: state.money - (choice.cost ?? 0),
    live: { ...live, pendingEvent: null },
  }
  const applied = choice.apply(cleared)
  return addLog(
    { ...applied, history: [...applied.history, { kind: 'choice', sprint: state.sprint, eventId: event.id, choiceId }] },
    choice.result,
    'neutral',
  )
}
