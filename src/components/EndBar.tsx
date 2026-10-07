import type { GameStatus } from '../types/game'

type EndBarProps = {
  status: GameStatus
  title?: string | null
  album?: string | null
  onNext: () => void
  onHome: () => void
  loading?: boolean
}

const statusCopy: Record<Exclude<GameStatus, 'active'>, string> = {
  completed: 'MÚSICA COMPLETA',
  expired: 'TEMPO ESGOTADO',
  abandoned: 'LETRA REVELADA',
}

export function EndBar({
  status,
  title,
  album,
  onNext,
  onHome,
  loading,
}: EndBarProps) {
  if (status === 'active') return null

  return (
    <div className="end-bar">
      <div className="end-copy">
        <small>{statusCopy[status]}</small>
        <strong>{title || 'Música revelada'}</strong>
        {album && <span>{album}</span>}
      </div>

      <div className="end-actions">
        <button
          className="end-home-button"
          type="button"
          onClick={onHome}
          disabled={loading}
        >
          INÍCIO
        </button>

        <button
          className="end-next-button"
          type="button"
          onClick={onNext}
          disabled={loading}
        >
          {loading ? 'AGUARDE' : 'PRÓXIMA'}
        </button>
      </div>
    </div>
  )
}
