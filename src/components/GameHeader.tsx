type GameHeaderProps = {
  found: number
  total: number
  remainingSeconds: number
  progress: number
  active: boolean
  paused: boolean
  pausePending?: boolean
  pauseError?: string
  onTogglePause: () => void
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0')
}

export function GameHeader({
  found,
  total,
  remainingSeconds,
  progress,
  active,
  paused,
  pausePending,
  pauseError,
  onTogglePause,
}: GameHeaderProps) {
  const urgent = active && !paused && remainingSeconds <= 60

  return (
    <header className="game-header">
      <div className="game-stat-row">
        <div className="score" aria-label={found + ' de ' + total + ' palavras'}>
          <strong>{found}</strong>
          <span>/ {total}</span>
        </div>

        <div className="game-time-actions">
          <div className={'timer ' + (urgent ? 'timer-urgent' : '')} aria-label="Tempo restante">
            {formatTime(remainingSeconds)}
          </div>

          {active && (
            <button
              type="button"
              className={'pause-button ' + (paused ? 'pause-button-resume' : '')}
              disabled={pausePending}
              onClick={onTogglePause}
              aria-pressed={paused}
              aria-label={paused ? 'Continuar partida' : 'Pausar partida'}
              title={paused ? 'Continuar partida' : 'Pausar partida'}
            >
              {paused ? (
                <svg
                  aria-hidden="true"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5.5a1 1 0 0 1 1.5-.86l9 6.5a1 1 0 0 1 0 1.72l-9 6.5A1 1 0 0 1 8 18.5z" />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {pauseError && (
        <div className="pause-error" role="alert">{pauseError}</div>
      )}

      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: progress + '%' }} />
      </div>
    </header>
  )
}
