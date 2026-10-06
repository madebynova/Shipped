import { isStuck } from './actions'
import { bugDrift } from './bugs'
import {
  BROKE_MORALE_PENALTY,
  BUGGY_MORALE_PENALTY,
  BUGGY_THRESHOLD,
  RELEASE_WINDOW,
  SLOTS_PER_SPRINT,
} from './config'
import { fadeHype, incomeFor, liveUpkeep, releaseSpike, runwayFor, salesDecay, startingSales } from './economy'
import { computeLegacy } from './legacy'
import { maybeStartEvent } from './liveEvents'
import { clampMorale, moraleTier } from './morale'
import { communityReaction, describeChanges, releaseSummary, snapshotOf } from './patchNotes'
import { startingPromises } from './promises'
import { getScope } from './scope'
import { addLog, plural } from './state'
import type { EndReason, Legacy, LiveState, Release, RunState, SprintEndEffects, SprintEndNote } from './types'

// LIVE UPDATES: what happens after a game ships.
//
// This is NOT a second game engine. A live game is the same RunState with phase = 'live': the same three
// action slots, the same five actions (applyAction does not know the difference), the same sprint loop.
// What changes is who pays. Sales fill the revenue account (state.money), upkeep drains it, and sales
// fade every sprint unless a release brings a new spike.
//
// Every function here is pure: it takes a state and returns a new one.

/** Cash the revenue account opens with: first-week sales plus whatever was left of the starting money. */
export function openingAccount(state: RunState): number {
  return Math.max(0, state.money) + (state.review?.sales.total ?? 0)
}

/** Why this run cannot launch updates, or null if it can. */
export function whyCannotLaunchUpdates(state: RunState): string | null {
  if (state.phase !== 'shipped' || !state.review) return 'Only a game that has just shipped can launch updates.'
  if (state.config.kind !== 'full') return 'The tutorial game ends here. Pass it to unlock the full game.'
  return null
}

/**
 * LAUNCH UPDATES: keep developing the shipped game. The launch review stays exactly as it was; sprints
 * continue, paid for by sales. Promised features that were cut become promises to finish.
 */
export function launchUpdates(state: RunState): RunState {
  if (whyCannotLaunchUpdates(state) !== null) return state
  const review = state.review!
  const live: LiveState = {
    launchScore: review.score,
    launchSprint: state.sprint,
    minor: 0,
    sprintsLive: 0,
    sprintsSinceRelease: 0,
    sales: startingSales(review.sales.total),
    totalSales: review.sales.total,
    promises: startingPromises(state),
    cancelled: [],
    originalityBonus: 0,
    warned: false,
    pendingEvent: null,
    eventHistory: [],
    pendingNotes: [],
    snapshot: snapshotOf(state),
    legacyAtRelease: review.score,
    releases: [],
  }
  const next: RunState = {
    ...state,
    phase: 'live',
    live,
    money: openingAccount(state),
    sprint: state.sprint + 1,
    actionsLeft: SLOTS_PER_SPRINT,
    history: [...state.history, { kind: 'launchUpdates', sprint: state.sprint }],
  }
  return addLog(
    next,
    `${state.concept.title} goes live. The revenue account opens with $${next.money}. Updates are funded by sales.`,
    'good',
  )
}

/** Write the final card. `reason` says whether the player chose it or the money ran out. */
function finalize(state: RunState, reason: EndReason): RunState {
  const review = state.review!
  const live = state.live
  const legacy: Legacy = {
    ...computeLegacy(state),
    launchScore: review.score,
    launchBand: review.band,
    reason,
    liveSprints: live?.sprintsLive ?? 0,
    releases: live?.releases.length ?? 0,
    totalSales: live?.totalSales ?? review.sales.total,
  }
  const next: RunState = {
    ...state,
    phase: 'retired',
    actionsLeft: 0,
    legacy,
    live: live ? { ...live, pendingEvent: null } : null,
  }
  return reason === 'broke'
    ? addLog(next, `The revenue account is empty. ${state.concept.title} is retired.`, 'bad')
    : addLog(next, `${state.concept.title} is retired. The legacy card is written.`, 'neutral')
}

/**
 * RETIRE GAME: end the run now. Allowed straight from the review (the legacy score is then exactly the
 * launch score) or at any point during the live phase. Retiring is always possible, even mid-event.
 */
export function retireGame(state: RunState): RunState {
  if ((state.phase !== 'shipped' && state.phase !== 'live') || !state.review) return state
  return finalize({ ...state, history: [...state.history, { kind: 'retire', sprint: state.sprint }] }, 'retired')
}

/* ------------------------------------------------------------------------------------------
   Releases
   ------------------------------------------------------------------------------------------ */

/** The update window opens after RELEASE_WINDOW live sprints without a release. */
export function isUpdateWindowOpen(live: LiveState): boolean {
  return live.sprintsSinceRelease >= RELEASE_WINDOW
}

/** Why a release is not possible right now, or null if it is. */
export function whyCannotRelease(state: RunState): string | null {
  if (state.phase !== 'live' || !state.live) return 'Only a live game can release updates.'
  if (state.live.pendingEvent) return 'Decide what to do about the event first.'
  if (!describeChanges(state).changed) return 'Nothing new since the last release.'
  return null
}

export interface ReleasePreview {
  ok: boolean
  reason?: string
  /** Before the update window opened: the spike will be smaller. */
  early: boolean
  legacyBefore: number
  legacyAfter: number
  /** Extra sales per sprint this release would add. */
  spike: number
  /** The patch-note lines it would print. */
  items: string[]
}

/** What releasing right now would do, without doing it. The UI shows this on the RELEASE button. */
export function previewRelease(state: RunState): ReleasePreview {
  const live = state.live
  if (!live) return { ok: false, reason: 'Not a live game.', early: false, legacyBefore: 0, legacyAfter: 0, spike: 0, items: [] }
  const changes = describeChanges(state)
  const legacyAfter = computeLegacy(state).score
  const early = !isUpdateWindowOpen(live)
  const reason = whyCannotRelease(state)
  return {
    ok: reason === null,
    reason: reason ?? undefined,
    early,
    legacyBefore: live.legacyAtRelease,
    legacyAfter,
    spike: releaseSpike(legacyAfter - live.legacyAtRelease, changes.newFeatures, state.hype, early),
    items: changes.items,
  }
}

/**
 * RELEASE AN UPDATE. It costs nothing extra and can be done at any time, but an update released before the
 * window opens (4 live sprints after the last one) sells less. It writes patch notes, publishes the new legacy
 * score, and adds a spike to sales per sprint that grows with how much better the game got.
 */
export function releaseUpdate(state: RunState): RunState {
  if (whyCannotRelease(state) !== null) return state
  const live = state.live!
  const preview = previewRelease(state)
  const changes = describeChanges(state)
  const release: Release = {
    version: `v1.${live.minor + 1}`,
    liveSprint: live.sprintsLive + 1,
    summary: releaseSummary(changes),
    notes: changes.items,
    reaction: communityReaction(preview.legacyBefore, preview.legacyAfter, state.seed + live.minor),
    legacyBefore: preview.legacyBefore,
    legacyAfter: preview.legacyAfter,
    spike: preview.spike,
    early: preview.early,
  }
  const next: RunState = {
    ...state,
    history: [...state.history, { kind: 'release', sprint: state.sprint }],
    live: {
      ...live,
      minor: live.minor + 1,
      sprintsSinceRelease: 0,
      sales: live.sales + preview.spike,
      // the bar for the next spike is your best published score, so a dip-and-recover does not pay twice
      legacyAtRelease: Math.max(live.legacyAtRelease, preview.legacyAfter),
      snapshot: snapshotOf(state),
      pendingNotes: [],
      releases: [...live.releases, release],
    },
  }
  return addLog(
    next,
    `${release.version} goes out: ${release.summary}. Sales ${preview.spike > 0 ? `+$${preview.spike}` : 'unchanged'} a sprint.`,
    preview.spike > 0 ? 'good' : 'neutral',
  )
}

/* ------------------------------------------------------------------------------------------
   Closing a live sprint
   ------------------------------------------------------------------------------------------ */

/**
 * What closing this live sprint will do. The UI previews it (so the player is never surprised), and
 * endLiveSprint applies it. `money` is the net change: sales in, upkeep out.
 */
export function liveSprintEndEffects(state: RunState): SprintEndEffects {
  const live = state.live
  const { level } = getScope(state.features)
  const drift = bugDrift(level, moraleTier(state.morale))
  const upkeep = liveUpkeep(level)
  const income = live ? incomeFor(live.sales, state.hype) : 0
  const net = income - upkeep

  const notes: SprintEndNote[] = [
    { text: `Sales bring in $${income}. The team costs $${upkeep}.`, tone: net >= 0 ? 'good' : 'warn' },
  ]
  let morale = 0
  if (drift > 0) notes.push({ text: `Scope is ${level}: ${plural(drift, 'bug')} creep in on their own.`, tone: 'warn' })
  if (state.bugs + drift >= BUGGY_THRESHOLD) {
    morale -= BUGGY_MORALE_PENALTY
    notes.push({ text: 'The team is demoralised by the bug count.', tone: 'bad' })
  }
  if (state.money + net < 0) {
    if (live?.warned) {
      notes.push({ text: 'The account cannot cover this sprint, and you were warned. The studio will close.', tone: 'bad' })
    } else {
      morale -= BROKE_MORALE_PENALTY
      notes.push({ text: 'The account cannot cover this sprint. The team works unpaid next sprint, and morale takes a hit.', tone: 'bad' })
    }
  }
  return { money: net, bugs: drift, morale, notes, income, upkeep }
}

/**
 * Close a live sprint (all three slots spent):
 *  1. sales come in, upkeep goes out, bugs creep in, buzz fades;
 *  2. sales shrink by a factor that depends on how good the game is now;
 *  3. if the account cannot cover the sprint it is a WARNING sprint the first time (the team works
 *     unpaid for one more sprint). If it still cannot cover the one after that, the studio closes;
 *  4. otherwise the next sprint starts, and it may open with an event.
 */
export function endLiveSprint(state: RunState): RunState {
  const live = state.live
  if (state.phase !== 'live' || !live || (state.actionsLeft > 0 && !isStuck(state)) || live.pendingEvent) return state

  const fx = liveSprintEndEffects(state)
  const income = fx.income ?? 0
  const sales = Math.round(live.sales * salesDecay(computeLegacy(state).score))
  const hype = fadeHype(state.hype)

  let bank = state.money + fx.money
  let forced = false
  let grace = false
  if (bank < 0) {
    if (live.warned) forced = true
    else {
      bank = 0
      grace = true
    }
  }

  let next: RunState = {
    ...state,
    history: [...state.history, { kind: 'endSprint', sprint: state.sprint }],
    money: bank,
    bugs: state.bugs + fx.bugs,
    morale: clampMorale(state.morale + fx.morale),
    hype,
    live: {
      ...live,
      sales,
      totalSales: live.totalSales + income,
      sprintsLive: live.sprintsLive + 1,
      sprintsSinceRelease: live.sprintsSinceRelease + 1,
    },
  }
  for (const note of fx.notes) next = addLog(next, note.text, note.tone)

  // The studio could not pay: the account is empty and the game is retired (it was warned a sprint ago).
  if (forced) return finalize({ ...next, money: 0 }, 'broke')

  next = { ...next, sprint: state.sprint + 1, actionsLeft: SLOTS_PER_SPRINT }

  // Will the account cover the sprint that is about to start? If not, this is the warning sprint.
  const upkeepNext = liveUpkeep(getScope(next.features).level)
  const warned = grace || bank + incomeFor(sales, hype) < upkeepNext
  next = { ...next, live: { ...next.live!, warned } }
  if (warned && !live.warned) {
    next = addLog(
      next,
      'WARNING: the account will not cover another sprint. Release an update, push sales, or retire the game.',
      'bad',
    )
  }
  return maybeStartEvent(next)
}

/** How many more sprints the account can pay for if nothing new happens (no releases, no events). */
export function liveRunway(state: RunState): number {
  const live = state.live
  if (!live) return 0
  const decay = salesDecay(computeLegacy(state).score)
  return runwayFor(state.money, live.sales, state.hype, decay, liveUpkeep(getScope(state.features).level))
}

/** Live sprints so far, counting the one in progress (1 = the first sprint after launch). */
export function liveSprintNumber(state: RunState): number {
  return state.live ? state.sprint - state.live.launchSprint : 0
}
