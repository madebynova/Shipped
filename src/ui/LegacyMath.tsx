import type { LegacyScore } from '../engine'
import { signed } from './format'
import { HELP } from './help'

/** The arithmetic behind the legacy score, as tooltip text: only the lines that are not zero. */
export default function LegacyMath({ legacy }: { legacy: LegacyScore }) {
  const lines: [string, number][] = [
    ['Review of the game as it is now', legacy.review],
    ['Skeptical players discount the climb', -legacy.skepticism],
    ['Promises still unbuilt', -legacy.promisePenalty],
    ['Cancelled promises', -legacy.cancelPenalty],
    ['COMPLETE bonus', legacy.completeBonus],
  ]
  return (
    <span className="math-tip">
      {HELP.legacyScore}
      {lines
        .filter(([, n], i) => i === 0 || n !== 0)
        .map(([label, n], i) => (
          <span key={label} className="math-line">
            <span>{label}</span>
            <b>{i === 0 ? n : signed(n)}</b>
          </span>
        ))}
      <span className="math-line math-total">
        <span>Legacy score</span>
        <b>{legacy.score}</b>
      </span>
    </span>
  )
}
