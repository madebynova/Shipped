import type { ArchiveEntry } from '../save'
import { slug } from './format'

const SHOWN = 5

/**
 * The studio archive: your most recent shipped games, tutorial included. Every game keeps TWO scores forever:
 * the LAUNCH score (its first impression, which never changes) and the LEGACY score (where it ended up).
 */
export default function Archive({ entries }: { entries: ArchiveEntry[] }) {
  if (entries.length === 0) return null
  return (
    <section className="archive" aria-label="Studio archive">
      <h2 className="eyebrow">STUDIO ARCHIVE</h2>
      <div className="archive-head" aria-hidden="true">
        <span>GAME</span>
        <span>LAUNCH</span>
        <span>LEGACY</span>
      </div>
      <ul>
        {entries.slice(0, SHOWN).map((entry) => (
          <li key={entry.id} className="archive-row">
            <span className="archive-title">
              {entry.title}
              {entry.kind === 'tutorial' && <em className="tutorial-tag">TUTORIAL</em>}
              {entry.complete && <em className="complete-tag">COMPLETE</em>}
            </span>
            <b className={`archive-score band-${slug(entry.band)}`} title={`Launch: ${entry.band}`}>
              {entry.score}
            </b>
            <b className={`archive-score band-${slug(entry.legacyBand)}`} title={`Legacy: ${entry.legacyBand}`}>
              {entry.legacyScore}
            </b>
          </li>
        ))}
      </ul>
    </section>
  )
}
