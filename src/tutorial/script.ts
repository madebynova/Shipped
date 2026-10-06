import { SHIP_UNLOCK_SPRINT, TUTORIAL_PASS_SCORE, canShip, computeReview, getScope, moraleTier, sprintUpkeep } from '../engine'
import type { Concept, Feature, RunState } from '../engine'

// MY FIRST GAME: a short guided run. Everything here is *teaching only*: events and tips
// read the run and explain it, but never change it. The tutorial is the real game on a
// smaller scale (6 sprints, 4 feature cards), with friendly commentary on top.

/** A charming starter concept the player can rename. */
export const TUTORIAL_CONCEPT: Concept = {
  title: 'Lantern Hollow',
  idea: 'A cozy adventure where a tiny lantern-keeper befriends forest spirits, crafts glowing gear and wakes a sleepy village.',
  genre: 'RPG',
}

/* ------------------------------------------------------------------ events ---------- */

/** A scripted teaching moment at the start of a fixed sprint. */
export interface TutorialEvent {
  id: string
  sprint: number
  kicker: string
  title: string
  body: (run: RunState) => string[]
  why: (run: RunState) => string
}

const builtFeatures = (run: RunState): Feature[] => run.features.filter((f) => f.state !== 'PLANNED')

function weakestBuilt(run: RunState): Feature | undefined {
  return builtFeatures(run)
    .filter((f) => f.quality < 100)
    .sort((a, b) => a.quality - b.quality)[0]
}

export const TUTORIAL_EVENTS: readonly TutorialEvent[] = [
  {
    id: 'event-morale',
    sprint: 2,
    kicker: 'TEAM MEETING',
    title: 'Everyone is a little tired',
    body: (run) => [
      `Building is hard work. Morale is ${run.morale} (${moraleTier(run.morale)}) and every BUILD wears it down a bit.`,
      'REST gives the team a breather and wins morale back. It builds nothing, though, and that is the trade.',
    ],
    why: () => 'A tired team builds weaker work and creates more bugs. One well-timed REST can save you slots later.',
  },
  {
    id: 'event-scope',
    sprint: 3,
    kicker: 'STUDIO NOTES',
    title: 'The game is growing',
    body: (run) => [
      `Every feature makes the game bigger. Scope is ${getScope(run.features).level} now, and upkeep is $${sprintUpkeep(getScope(run.features).level)} each sprint.`,
      'A bigger game builds slower, fixes slower, grows bugs on its own and costs more to keep alive.',
    ],
    why: () => 'You cannot build everything. Choosing what to leave out is part of shipping a good game.',
  },
  {
    id: 'event-hype',
    sprint: 5,
    kicker: 'INCOMING CALL',
    title: 'A journalist wants a scoop',
    body: (run) => [
      `HYPE tells the world about your game. Right now hype is ${run.hype}${run.hype === 0 ? ', so nobody is expecting anything' : ''}.`,
      'Hype raises the bar the audience judges you by. It improves nothing about the game itself.',
    ],
    why: () => 'Hype is a bet. A strong game turns it into a better review; a rough game gets punished harder for it.',
  },
  {
    id: 'event-deadline',
    sprint: 6,
    kicker: 'FINAL SPRINT',
    title: 'This is the deadline',
    body: (run) => {
      const weak = weakestBuilt(run)
      return [
        'After your last action, the game ships exactly as it stands. No extensions.',
        run.bugs > 0
          ? `You have ${run.bugs} ${run.bugs === 1 ? 'bug' : 'bugs'} right now.${weak ? ` Your weakest feature is ${weak.name} at quality ${weak.quality}.` : ''}`
          : weak
            ? `No bugs, nice. Your weakest feature is ${weak.name} at quality ${weak.quality}.`
            : 'Spend your last slots where they will move the score most.',
      ]
    },
    why: () => 'The last three slots are your best chance to lift the score: fix bugs, or polish what is weakest.',
  },
]

/* -------------------------------------------------------------------- tips ---------- */

/** A small dismissible TEAM TIP that appears at a key moment. */
export interface TutorialTip {
  id: string
  /** True while the moment this tip is about is happening. */
  when: (run: RunState) => boolean
  /** Vanishes as soon as its moment passes, even if never dismissed (it still counts as shown). */
  ephemeral?: boolean
  text: (run: RunState) => string
}

const actionsTaken = (run: RunState): number => run.history.filter((e) => e.kind === 'action').length

export const TUTORIAL_TIPS: readonly TutorialTip[] = [
  {
    id: 'tip-actions',
    ephemeral: true,
    when: (run) => run.sprint === 1 && actionsTaken(run) === 0,
    text: () =>
      'Welcome to the studio! You get 3 actions a sprint. BUILD makes a feature playable, FIX removes bugs, POLISH makes it shine. Pick a card, then spend your slots. You can’t do everything.',
  },
  {
    id: 'tip-playable',
    when: (run) => builtFeatures(run).length > 0,
    text: (run) => {
      // Talk about the roughest card: that is the one a POLISH would help most.
      const first = [...builtFeatures(run)].sort((a, b) => a.quality - b.quality)[0]
      if (!first) return 'Your first feature is on its way. Playable is not the same as good: POLISH raises quality.'
      return `${first.name} is playable! Playable isn’t good yet: its quality is ${first.quality} out of 100. POLISH lifts it (70+ earns the gold POLISHED badge) and also clears a bug.`
    },
  },
  {
    id: 'tip-bugs',
    when: (run) => run.bugs >= 4,
    text: (run) =>
      `Bugs are piling up (${run.bugs}). Every BUILD adds some, and big games grow them on their own. FIX clears about 4 at a time. Left alone, they drag your review score down.`,
  },
  {
    id: 'tip-ship',
    when: (run) => canShip(run),
    text: (run) =>
      `The ship window is open! SHIP GAME ends the run and starts your review. Anything ${TUTORIAL_PASS_SCORE}+ passes your first game. Not ready? Keep polishing: the deadline is sprint ${run.config.totalSprints}.`,
  },
]

/* ---------------------------------------------------------------- progress ---------- */

/** What the tutorial has shown so far in this attempt, and what is on screen right now. */
export interface TutorialProgress {
  /** Ids of events and tips that were shown. They never repeat. */
  seen: string[]
  activeEvent: string | null
  activeTip: { id: string; sprint: number } | null
}

export const EMPTY_PROGRESS: TutorialProgress = { seen: [], activeEvent: null, activeTip: null }

export function findEvent(id: string | null): TutorialEvent | undefined {
  return id ? TUTORIAL_EVENTS.find((e) => e.id === id) : undefined
}

export function findTip(id: string | null): TutorialTip | undefined {
  return id ? TUTORIAL_TIPS.find((t) => t.id === id) : undefined
}

const withSeen = (p: TutorialProgress, id: string): string[] => (p.seen.includes(id) ? p.seen : [...p.seen, id])

/**
 * Decide what the tutorial should be showing for this run state. Call it whenever the run
 * changes. An event wins over a tip; a tip lives until its moment passes or the sprint ends;
 * anything shown is remembered and never shown again.
 */
export function advanceTutorial(run: RunState, progress: TutorialProgress): TutorialProgress {
  if (run.config.kind !== 'tutorial' || run.phase !== 'developing') {
    return { ...progress, activeEvent: null, activeTip: null }
  }

  let { seen, activeEvent, activeTip } = progress

  // A tip expires when the sprint moves on or the moment it was about is over (it counts as shown).
  if (activeTip) {
    const tip = findTip(activeTip.id)
    const expired = activeTip.sprint !== run.sprint || (tip?.ephemeral === true && !tip.when(run))
    if (expired) {
      seen = withSeen({ ...progress, seen }, activeTip.id)
      activeTip = null
    }
  }

  if (!activeEvent) {
    const due = TUTORIAL_EVENTS.find((e) => e.sprint === run.sprint && !seen.includes(e.id))
    if (due) activeEvent = due.id
  }

  if (!activeEvent && !activeTip) {
    const next = TUTORIAL_TIPS.find((t) => !seen.includes(t.id) && t.when(run))
    if (next) activeTip = { id: next.id, sprint: run.sprint }
  }

  return { seen, activeEvent, activeTip }
}

export function dismissEvent(progress: TutorialProgress): TutorialProgress {
  if (!progress.activeEvent) return progress
  return { ...progress, seen: withSeen(progress, progress.activeEvent), activeEvent: null }
}

export function dismissTip(progress: TutorialProgress): TutorialProgress {
  if (!progress.activeTip) return progress
  return { ...progress, seen: withSeen(progress, progress.activeTip.id), activeTip: null }
}

/* -------------------------------------------------------------- what happened ------- */

export function tutorialPassed(run: RunState): boolean {
  return run.review !== null && run.review.score >= TUTORIAL_PASS_SCORE
}

const list = (names: string[]): string =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/**
 * "WHAT JUST HAPPENED": four plain-language bullets that connect the player's choices to the
 * numbers in the review. Built from the real final state, so it is always about *their* run.
 */
export function explainRun(run: RunState): string[] {
  const review = run.review
  if (!review) return []
  const built = builtFeatures(run)
  const polished = built.filter((f) => f.state === 'POLISHED')
  const bullets: string[] = []

  // 1. How much game there was.
  if (built.length === 0) {
    bullets.push('You shipped before building anything, so there was no game to review. BUILD is how a card becomes playable.')
  } else if (built.length === run.features.length) {
    bullets.push(
      `You built all ${built.length} features, which maxed out CONTENT (${review.content}). More features also grow scope, which makes work slower and costlier.`,
    )
  } else {
    const left = run.features.length - built.length
    bullets.push(
      `You built ${built.length} of ${run.features.length} features (${list(built.map((f) => f.name))}), giving CONTENT ${review.content}. The ${left} you skipped cost nothing, but added nothing either.`,
    )
  }

  // 2. How good it was.
  if (built.length > 0) {
    const average = Math.round(built.reduce((sum, f) => sum + f.quality, 0) / built.length)
    bullets.push(
      polished.length > 0
        ? `${polished.length} of your features reached POLISHED. Average quality was ${average}, which set POLISH at ${review.polish}. Polishing is the surest way to lift a score.`
        : `No feature reached POLISHED (70+). Average quality was ${average}, which held POLISH at ${review.polish}. A couple of POLISH actions on your best feature would have helped.`,
    )
  } else {
    bullets.push(`With nothing built, quality could not count: POLISH was ${review.polish}.`)
  }

  // 3. What the bugs cost.
  if (run.bugs > 0) {
    const without = computeReview({ ...run, bugs: 0 }, review.forced).score
    const cost = without - review.score
    bullets.push(
      cost >= 1
        ? `You shipped with ${run.bugs} ${run.bugs === 1 ? 'bug' : 'bugs'}. They cost about ${cost} ${cost === 1 ? 'point' : 'points'}: with none you would have scored ${without}. One FIX clears around 4.`
        : `You shipped with ${run.bugs} ${run.bugs === 1 ? 'bug' : 'bugs'}, a small dent this time. They add up quickly in bigger games.`,
    )
  } else {
    bullets.push('You shipped with zero bugs, so nothing dragged your score down. FIX at the right moment pays for itself.')
  }

  // 4. Hype, the team, or the clock: whichever shaped this run most.
  if (review.hypeModifier > 0) {
    bullets.push(
      `Hype ${run.hype} set the bar at ${review.hypeBar}. Your game beat it, so hype added +${review.hypeModifier}. Hype rewards strong games.`,
    )
  } else if (review.hypeModifier < 0) {
    bullets.push(
      `Hype ${run.hype} set the bar at ${review.hypeBar}, but your game fell short of it, costing ${Math.abs(review.hypeModifier)}. Hype punishes games that cannot back it up.`,
    )
  } else if (run.morale < 30) {
    bullets.push(`Your team ended burned out (morale ${run.morale}). That made late work weaker and buggier. A REST earlier would have protected it.`)
  } else if (review.shippedSprint < run.config.totalSprints && review.shippedSprint >= SHIP_UNLOCK_SPRINT) {
    const early = run.config.totalSprints - review.shippedSprint
    bullets.push(`You shipped ${early} ${early === 1 ? 'sprint' : 'sprints'} early. That locks in what you have: less time to polish, but no more bugs creeping in.`)
  } else {
    bullets.push('You did not use hype, so the audience had no expectations to beat or miss. Hype is a bet: worth it for a strong game, risky for a weak one.')
  }

  return bullets
}
