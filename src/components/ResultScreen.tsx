type ResultScreenProps = {
  completed: boolean
  found: number
  total: number
  title?: string | null
  album?: string | null
  onNext: () => void
}

export function ResultScreen({ completed, found, total, title, album, onNext }: ResultScreenProps) {
  const percentage = total ? Math.round((found / total) * 100) : 0

  return (
    <main className="result-screen">
      <section className="result-card">
        <p className="result-eyebrow">{completed ? '100%' : percentage + '%'}</p>
        <h2>{completed ? 'You did it, Malu ♡' : 'Time’s up'}</h2>
        <p className="result-score"><strong>{found}</strong> / {total} palavras</p>

        <div className="result-song">
          <span>{title || 'Música revelada no fim'}</span>
          {album && <small>{album}</small>}
        </div>

        <button className="next-button" type="button" onClick={onNext}>PRÓXIMA</button>
      </section>
    </main>
  )
}
