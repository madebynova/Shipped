import { promisedFeatures } from './promises'
import { plural } from './state'
import type { Legacy, LiveSnapshot, RunState } from './types'

// Patch notes, community reactions and the final legacy-card verdict. Like reviewText.ts this is
// plain rules over the real state: the same run always gives the same words, and nothing is random.

/** At this many bugs, a decline is blamed on neglect rather than on the updates. */
const BUG_PILE = 6

/** A feature has to gain at least this much quality to be called "improved" in the notes. */
const QUALITY_JUMP = 8

/** Funny things that get "fixed". Picked by a simple formula from the run's seed so notes are stable. */
const BUG_FLAVOR = [
  'the co-op crash',
  'a crash when pausing mid-cutscene',
  'the save file that ate your inventory',
  'enemies walking through walls',
  'a soft-lock in the second area',
  'a menu that opened twice',
  'textures that forgot to load',
  'the infamous ladder glitch',
  'a physics bug that launched the hero into orbit',
  'a door that only opened for NPCs',
  'audio that played backwards',
  'a typo that crashed the game (a typo!)',
]

export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** A record of how the game looks right now, kept so the next release can say what changed. */
export function snapshotOf(state: RunState): LiveSnapshot {
  return {
    features: state.features.map((f) => ({ id: f.id, state: f.state, quality: f.quality })),
    bugs: state.bugs,
    cancelled: state.live?.cancelled.length ?? 0,
  }
}

export interface Changes {
  /** Patch-note lines, in reading order. */
  items: string[]
  /** Short phrases for the one-line summary ("polished Vehicles"). */
  parts: string[]
  /** Features that were unbuilt at the last release and are built now. */
  newFeatures: number
  /** True if anything at all is different since the last release. */
  changed: boolean
}

/** What is different between the game at the last release and the game right now? */
export function describeChanges(state: RunState): Changes {
  const live = state.live
  if (!live) return { items: [], parts: [], newFeatures: 0, changed: false }

  const snap = live.snapshot
  const promised = promisedFeatures(state.concept)
  const added: string[] = []
  const polished: string[] = []
  const improved: string[] = []
  let anyQualityChange = false

  for (const f of state.features) {
    const before = snap.features.find((s) => s.id === f.id)
    if (!before) continue
    if (before.state === 'PLANNED' && f.state !== 'PLANNED') {
      added.push(promised.includes(f.id) ? `${f.name} (as promised)` : f.name)
    } else if (before.state !== 'POLISHED' && f.state === 'POLISHED') {
      polished.push(f.name)
    } else if (before.state !== 'PLANNED' && f.quality - before.quality >= QUALITY_JUMP) {
      improved.push(f.name)
    }
    if (before.quality !== f.quality || before.state !== f.state) anyQualityChange = true
  }

  const items: string[] = []
  const parts: string[] = []
  if (added.length > 0) {
    items.push(`Added ${joinNames(added)}`)
    parts.push(`added ${joinNames(added.map((n) => n.replace(' (as promised)', '')))}`)
  }
  if (polished.length > 0) {
    items.push(`Polished ${joinNames(polished)}`)
    parts.push(`polished ${joinNames(polished)}`)
  }
  if (improved.length > 0) {
    items.push(`Improved ${joinNames(improved)}`)
    parts.push(`improved ${joinNames(improved)}`)
  }

  const bugDelta = snap.bugs - state.bugs
  if (bugDelta > 0) {
    const flavor = BUG_FLAVOR[(state.seed + live.minor * 7) % BUG_FLAVOR.length]
    items.push(`Fixed ${plural(bugDelta, 'bug')}, including ${flavor}`)
    parts.push(`fixed ${flavor}`)
  } else if (bugDelta < 0) {
    items.push(`Known issues: ${plural(-bugDelta, 'new bug')}, under investigation`)
  }

  const cancelledNow = live.cancelled.slice(snap.cancelled)
  if (cancelledNow.length > 0) {
    const cancelledNames = cancelledNow.map((id) => state.features.find((f) => f.id === id)?.name ?? id)
    items.push(`Removed ${joinNames(cancelledNames)} from the roadmap`)
    parts.push('trimmed the roadmap')
  }

  for (const note of live.pendingNotes) {
    items.push(note)
    parts.push(note.charAt(0).toLowerCase() + note.slice(1))
  }

  const changed = items.length > 0 || anyQualityChange || bugDelta !== 0
  if (items.length === 0 && changed) items.push('Small quality and balance tweaks')

  return { items, parts, newFeatures: added.length, changed }
}

/** The one-line headline of a release: "polished Vehicles, fixed the co-op crash". */
export function releaseSummary(changes: Changes): string {
  return changes.parts.length > 0 ? changes.parts.slice(0, 2).join(', ') : 'minor tweaks'
}

const REACTIONS = {
  thrilled: [
    'The community is thrilled. "This is the game they promised us."',
    'Forums light up. "I am cancelling my plans this weekend."',
  ],
  turnaround: [
    'Reviews climb back up. Players call it a real turnaround.',
    '"They fixed it. They actually fixed it." Reviews follow.',
  ],
  warm: [
    'A warm reception. "Nice to see the devs listening."',
    'Players approve. A fan posts a very long thank-you.',
  ],
  polite: [
    'A polite thumbs up. The forums are already asking about the next update.',
    'Quiet approval. A few players say they will give it another go.',
  ],
  shrug: [
    'Nobody notices. Next time, bring something new.',
    'The patch notes get exactly zero comments.',
  ],
  grumpy: [
    'Players are grumpy. "It was better before."',
    'The forums are not happy. A thread called "what happened?" is trending.',
  ],
} as const

/** How the community reacts, from how much the legacy score moved since the last release. */
export function communityReaction(legacyBefore: number, legacyAfter: number, variant: number): string {
  const delta = legacyAfter - legacyBefore
  const tier =
    delta >= 10 ? 'thrilled' : delta >= 6 ? 'turnaround' : delta >= 3 ? 'warm' : delta >= 1 ? 'polite' : delta === 0 ? 'shrug' : 'grumpy'
  const lines = REACTIONS[tier]
  return lines[Math.abs(variant) % lines.length]
}

/**
 * The words on the final legacy card: how the updates changed the game's standing, how it ended, and
 * what happened to the promises. Four lines at most.
 */
export function legacyVerdict(state: RunState, legacy: Legacy): string[] {
  const { title, vision } = state.concept
  const live = state.live
  const lines: string[] = []
  const delta = legacy.score - legacy.launchScore

  if (!live) {
    lines.push(`You retired ${title} straight after launch. Its legacy is exactly its launch.`)
  } else if (legacy.complete) {
    lines.push(`${title} ends as a COMPLETE game: every feature polished, no bugs, every promise kept.`)
  } else if (delta >= 10) {
    lines.push(`The updates turned ${title} around: ${legacy.launchBand} at launch, ${legacy.band} in the end.`)
  } else if (delta >= 3) {
    lines.push(`${title} finished better than it launched. The updates were worth it.`)
  } else if (delta >= -2) {
    lines.push(`Players remember ${title} about the way it launched.`)
  } else if (state.bugs >= BUG_PILE) {
    // The honest cause: the game was left alone and the bugs took over.
    lines.push(`The bugs piled up and nobody fixed them: ${title} is remembered as worse than it launched.`)
  } else {
    lines.push(`The updates did more harm than good: ${title} is remembered as worse than it launched.`)
  }

  if (live) {
    if (legacy.reason === 'broke') {
      lines.push(`The revenue account ran dry after ${plural(live.sprintsLive, 'live sprint')} and the studio closed its doors.`)
    } else {
      lines.push(
        `You retired it after ${plural(live.sprintsLive, 'live sprint')} and ${plural(live.releases.length, 'release')}, with $${Math.max(0, state.money)} left in the account.`,
      )
    }
    const nameOf = (id: string) => state.features.find((f) => f.id === id)?.name ?? id
    if (live.cancelled.length > 0) {
      lines.push(`Cancelled for good: ${joinNames(live.cancelled.map(nameOf))}. The community remembers.`)
    } else if (legacy.unresolved.length > 0) {
      lines.push(`Still unbuilt when it ended: ${joinNames(legacy.unresolved.map(nameOf))}.`)
    } else if (live.promises.length > 0) {
      lines.push('Every promise was kept.')
    }
  }

  if (vision) lines.push(`You set out to make: ${vision}.`)
  return lines.slice(0, 4)
}
