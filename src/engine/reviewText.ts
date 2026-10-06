import { TOTAL_SPRINTS } from './config'
import type { Review, ReviewBand, RunState } from './types'

// Review prose is assembled from rules that look at the real final state.
// Same state in, same words out: no randomness, no model calls.

interface Line {
  text: string
  /** Higher priority lines are kept when there are too many. */
  priority: number
}

const MAX_EXTRA_LINES = 3

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function opening(title: string, genre: string, band: ReviewBand): string {
  switch (band) {
    case 'MASTERPIECE':
      return `${title} is the rare ${genre} game that gets almost everything right.`
    case 'GREAT':
      return `${title} is a confident ${genre} game that most players will be glad they tried.`
    case 'SOLID':
      return `${title} is a solid ${genre} game with a clear identity and a few visible seams.`
    case 'ROUGH':
      return `${title} has the bones of a ${genre} game, but it is rough around the edges.`
    case 'DISASTER':
      return `${title} reaches players as a ${genre} game in name more than in practice.`
    case 'LEGENDARY FAILURE':
      return `${title} will be remembered, just not for the reasons you hoped.`
  }
}

export function buildVerdict(state: RunState, review: Review): string[] {
  const { title, genre } = state.concept
  const built = state.features.filter((f) => f.state !== 'PLANNED')
  const names = built.map((f) => f.name)
  const polishedCount = built.filter((f) => f.state === 'POLISHED').length
  const lines: Line[] = []
  const add = (priority: number, text: string) => lines.push({ priority, text })

  // Content / scope
  if (built.length === 0) {
    add(95, 'There is no game here: nothing was playable at launch.')
  } else if (built.length <= 2 && review.polish >= 65) {
    add(75, 'The smaller feature set benefits from unusually strong refinement.')
  } else if (built.length <= 2) {
    add(70, `There is very little game here: only ${joinNames(names)} made it into the build.`)
  } else if (built.length >= 5) {
    add(
      65,
      review.polish < 55
        ? `An ambitious scope, with ${joinNames(names)} all in the build, but little of it feels finished.`
        : `An ambitious scope, with ${joinNames(names)} all in the build, and most of it holds together.`,
    )
  } else {
    add(25, `${joinNames(names)} give the game a recognisable shape.`)
  }

  // Bugs
  if (state.bugs >= 14) {
    add(80, `The build is crawling with bugs (${state.bugs} known) and reviewers hit them constantly.`)
  } else if (state.bugs >= 8) {
    add(70, 'The build has ambition, but the bugs frequently get in the way.')
  } else if (state.bugs >= 4) {
    add(30, `A handful of bugs (${state.bugs}) show through, though they rarely break the experience.`)
  } else if (built.length > 0) {
    add(
      40,
      state.bugs === 0
        ? 'The build is remarkably stable: reviewers could not find a single bug.'
        : `Stability is a quiet strength: only ${state.bugs} known ${state.bugs === 1 ? 'bug' : 'bugs'}.`,
    )
  }

  // Hype
  if (state.hype >= 25 && review.hypeModifier <= -4) {
    add(85, 'The audience expected more than the final build could deliver.')
  } else if (review.hypeModifier >= 4) {
    add(60, 'The buzz paid off: the final build lives up to the expectations you set.')
  } else if (state.hype >= 25) {
    add(35, 'Expectations were high, and the game only just met them.')
  } else if (state.hype < 10 && review.score >= 65) {
    add(30, 'Almost nobody had heard of it, but the people who found it were pleasantly surprised.')
  }

  // Polish and gameplay
  if (review.polish >= 80 && built.length >= 3) {
    add(55, 'Refinement is a highlight: the moment-to-moment feel is carefully tuned.')
  } else if (review.polish <= 35 && built.length > 0) {
    add(50, 'Little of it feels finished, with rough edges everywhere.')
  }
  if (review.gameplay >= 70 && polishedCount > 0) {
    add(45, 'The core gameplay is the strongest part of the package.')
  }

  // Originality
  if (review.originality >= 72) {
    add(45, `The concept stands out in a crowded ${genre} field.`)
  } else if (review.originality <= 45) {
    add(45, `The pitch feels familiar for a ${genre} game.`)
  }

  // The team and the bank account
  if (state.money < 0) {
    add(52, 'Development ran out of money before launch, and the rush shows.')
  }
  if (state.morale < 30) {
    add(50, 'The team was running on fumes by launch.')
  }

  // Timing
  if (review.forced) {
    add(20, 'The sprint-8 deadline arrived and the build shipped exactly as it stood.')
  } else if (review.shippedSprint < TOTAL_SPRINTS) {
    const early = TOTAL_SPRINTS - review.shippedSprint
    add(15, `It shipped in sprint ${review.shippedSprint}, ${early} ${early === 1 ? 'sprint' : 'sprints'} early.`)
  }

  const extras = lines
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_EXTRA_LINES)
    .map((l) => l.text)

  return [opening(title, genre, review.band), ...extras]
}
