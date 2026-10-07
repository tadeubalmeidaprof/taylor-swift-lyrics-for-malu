import { useEffect } from 'react'
import { GameHeader } from './components/GameHeader'
import { GuessInput } from './components/GuessInput'
import { IntroScreen } from './components/IntroScreen'
import { LyricsGrid } from './components/LyricsGrid'
import { ResultScreen } from './components/ResultScreen'
import { useGame } from './hooks/useGame'

function setThemeColor(color: string) {
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', color)
}

export default function App() {
  const {
    session,
    loading,
    message,
    remainingSeconds,
    progress,
    start,
    guess,
  } = useGame()

  useEffect(() => {
    setThemeColor(session ? '#ffffff' : '#0f0d16')
  }, [session])

  if (!session) {
    return <IntroScreen onPlay={start} loading={loading} />
  }

  if (session.status !== 'active') {
    return (
      <ResultScreen
        completed={session.status === 'completed'}
        found={session.foundWords}
        total={session.totalWords}
        title={session.finalTitle}
        album={session.finalAlbum}
        onNext={start}
      />
    )
  }

  return (
    <main className="game-screen">
      <div className="game-shell">
        <GameHeader
          found={session.foundWords}
          total={session.totalWords}
          remainingSeconds={remainingSeconds}
          progress={progress}
        />

        <GuessInput
          disabled={loading || session.status !== 'active'}
          message={message}
          onGuess={guess}
        />

        {session.wrongGuesses.length > 0 && (
          <div className="wrong-guesses" aria-label="Tentativas que não aparecem na música">
            {session.wrongGuesses.slice(-6).map((word) => (
              <span key={word}>{word}</span>
            ))}
          </div>
        )}

        <section className="lyrics-panel">
          <LyricsGrid
            totalWords={session.totalWords}
            revealed={session.revealed}
            chorusRanges={session.chorusRanges}
          />
        </section>
      </div>
    </main>
  )
}
