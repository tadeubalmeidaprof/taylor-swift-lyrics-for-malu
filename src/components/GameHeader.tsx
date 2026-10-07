type GameHeaderProps = {
  found: number
  total: number
  remainingSeconds: number
  progress: number
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0')
}

export function GameHeader({ found, total, remainingSeconds, progress }: GameHeaderProps) {
  const urgent = remainingSeconds <= 120

  return (
    <header className="game-header">
      <div className="game-stat-row">
        <div className="score" aria-label={found + ' de ' + total + ' palavras'}>
          <strong>{found}</strong>
          <span>/ {total}</span>
        </div>

        <div className={'timer ' + (urgent ? 'timer-urgent' : '')}>
          {formatTime(remainingSeconds)}
        </div>
      </div>

      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: progress + '%' }} />
      </div>
    </header>
  )
}
