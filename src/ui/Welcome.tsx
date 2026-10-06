import { TUTORIAL_PASS_SCORE, TUTORIAL_RUN } from '../engine'
import { useGameStore } from './store'

/** First launch only: the one door into the game is "MY FIRST GAME". */
export default function Welcome() {
  const begin = useGameStore((s) => s.beginTutorial)
  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="eyebrow">WELCOME TO SHIPPED</div>
        <h1 className="logo">SHIPPED</h1>
        <article className="first-game">
          <div className="first-game-art" aria-hidden="true">
            <span className="eyebrow">TUTORIAL</span>
            <span className="first-game-no">Nº 00</span>
          </div>
          <div className="first-game-body">
            <h2>MY FIRST GAME</h2>
            <p>
              Ship your first game in {TUTORIAL_RUN.totalSprints} sprints. The team walks you through it.
            </p>
            <button type="button" className="cta" autoFocus onClick={begin}>
              START
              <span>pass with {TUTORIAL_PASS_SCORE}+ to open your studio</span>
            </button>
          </div>
        </article>
        <p className="welcome-fine">The full game unlocks the moment you pass.</p>
      </div>
    </div>
  )
}
