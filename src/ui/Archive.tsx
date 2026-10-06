import type { ArchiveEntry } from '../save'
import { slug } from './format'

const SHOWN = 5

/** The studio archive: your most recent shipped games, tutorial included. */
export default function Archive({ entries }: { entries: ArchiveEntry[] }) {
  if (entries.length === 0) return null
  return (
    <section className="archive" aria-label="Studio archive">
      <h2 className="eyebrow">STUDIO ARCHIVE</h2>
      <ul>
        {entries.slice(0, SHOWN).map((entry) => (
          <li key={entry.id} className={`archive-row band-${slug(entry.band)}`}>
            <span className="archive-title">
              {entry.title}
              {entry.kind === 'tutorial' && <em className="tutorial-tag">TUTORIAL</em>}
            </span>
            <span className="archive-band">{entry.band}</span>
            <b className="archive-score">{entry.score}</b>
          </li>
        ))}
      </ul>
    </section>
  )
}
