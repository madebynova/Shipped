import { useEffect } from 'react'
import ConceptScreen from './ui/ConceptScreen'
import GameScreen from './ui/GameScreen'
import ReviewScreen from './ui/ReviewScreen'
import { useGameStore } from './ui/store'

export default function App() {
  const screen = useGameStore((s) => s.screen)
  const seed = useGameStore((s) => s.run?.seed)

  // Every new screen starts at the top, wherever the last one was scrolled to.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen, seed])

  // Keying on the seed remounts the screen for every new run, so no local UI
  // state (targeting mode, ship confirmation, animations) can leak between runs.
  if (screen === 'game') return <GameScreen key={seed} />
  if (screen === 'review') return <ReviewScreen key={seed} />
  return <ConceptScreen />
}
