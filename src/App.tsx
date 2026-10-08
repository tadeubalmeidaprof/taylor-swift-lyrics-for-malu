import { useEffect, useState } from 'react'
import { EndBar } from './components/EndBar'
import { GameHeader } from './components/GameHeader'
import { GiveUpDialog } from './components/GiveUpDialog'
import { GuessInput } from './components/GuessInput'
import { IntroScreen } from './components/IntroScreen'
import { LyricsGrid } from './components/LyricsGrid'
import { LoadingScreen } from './components/LoadingScreen'
import { useGame } from './hooks/useGame'

function setThemeColor(color: string) {
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', color)
}

export default function App() {
  const [showGiveUp, setShowGiveUp] = useState(false)

  const {
    session,
    loading,
    startError,
    remainingSeconds,
    progress,
    start,
    guess,
    giveUp,
    goHome,
    togglePause,
    pausePending,
    pauseError,
  } = useGame()

  useEffect(() => {
    setThemeColor(session ? '#000000' : '#0f0d16')
  }, [session])

  if (!session) {
    if (loading) {
      return <LoadingScreen />
    }

    return <IntroScreen onPlay={start} loading={false} error={startError} />
  }

  const active = session.status === 'active'

  async function handleGiveUp() {
    await giveUp()
    setShowGiveUp(false)
  }

  return (
    <main className="game-screen">
      <div className="game-shell">
        <GameHeader
          found={session.foundWords}
          total={session.totalWords}
          remainingSeconds={remainingSeconds}
          progress={progress}
          active={session.status === 'active'}
          paused={session.paused}
          pausePending={pausePending}
          pauseError={pauseError}
          onTogglePause={() => void togglePause()}
        />

        {active ? (
          <GuessInput
            disabled={loading || pausePending}
            paused={session.paused}
            onGuess={guess}
            onGiveUp={() => setShowGiveUp(true)}
          />
        ) : (
          <EndBar
            status={session.status}
            title={session.finalTitle}
            album={session.finalAlbum}
            onNext={start}
            onHome={goHome}
            loading={loading}
          />
        )}

        <section className="lyrics-panel">
          <LyricsGrid
            totalWords={session.totalWords}
            revealed={session.revealed}
            chorusRanges={session.chorusRanges}
            foundPositions={session.foundPositions}
            status={session.status}
          />
        </section>
      </div>

      <GiveUpDialog
        open={showGiveUp}
        loading={loading}
        onCancel={() => setShowGiveUp(false)}
        onConfirm={() => void handleGiveUp()}
      />
    </main>
  )
}
