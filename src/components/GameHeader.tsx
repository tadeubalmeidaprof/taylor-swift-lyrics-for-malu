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
            >
              <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
              {pausePending ? 'AGUARDE' : paused ? 'CONTINUAR' : 'PAUSAR'}
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
