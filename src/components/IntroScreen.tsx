type IntroScreenProps = {
  onPlay: () => void
  loading?: boolean
}

export function IntroScreen({ onPlay, loading = false }: IntroScreenProps) {
  return (
    <main className="intro-screen">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <div className="star-field" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, index) => (
          <span key={index} className={"star star-" + ((index % 6) + 1)} />
        ))}
      </div>

      <section className="intro-card">
        <p className="intro-kicker">made with love</p>

        <h1 className="intro-title">
          <span>Swifter Lyrics</span>
          <em>for Malu</em>
        </h1>

        <p className="intro-copy">
          Uma música. Todas as palavras escondidas. Um cronômetro.
        </p>

        <button
          className="play-button"
          type="button"
          onClick={onPlay}
          disabled={loading}
        >
          <span>{loading ? 'LOADING' : 'PLAY'}</span>
        </button>
      </section>

      <p className="intro-footer">a little game for Malu ♡</p>
    </main>
  )
}
