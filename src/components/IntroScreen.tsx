type IntroScreenProps = {
  onPlay: () => void
  loading?: boolean
  error?: string
}

const braceletBeads = ['M', 'A', 'L', 'U', '♡', '1', '3']

export function IntroScreen({ onPlay, loading = false, error = '' }: IntroScreenProps) {
  return (
    <main className="intro-screen">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <div className="mirrorball-glow" aria-hidden="true">
        <span />
      </div>

      <div className="polaroid-ghost polaroid-ghost-a" aria-hidden="true" />
      <div className="polaroid-ghost polaroid-ghost-b" aria-hidden="true" />

      <div className="star-field" aria-hidden="true">
        {Array.from({ length: 13 }).map((_, index) => (
          <span key={index} className={"star star-" + (index + 1)} />
        ))}
        <i className="sparkle sparkle-a" />
        <i className="sparkle sparkle-b" />
        <i className="sparkle sparkle-c" />
      </div>

      <span className="lucky-thirteen" aria-hidden="true">13</span>

      <section className="intro-card">
        <p className="intro-kicker">made with love</p>

        <h1 className="intro-title">
          <span>Swifter Lyrics</span>
          <em>for Malu</em>
        </h1>

        <div className="friendship-bracelet" aria-hidden="true">
          <span className="bracelet-thread" />
          <div className="bracelet-beads">
            {braceletBeads.map((bead, index) => (
              <span
                key={bead + index}
                className={"bracelet-bead bracelet-bead-" + ((index % 4) + 1)}
              >
                {bead}
              </span>
            ))}
          </div>
        </div>

        <button
          className="play-button"
          type="button"
          onClick={onPlay}
          disabled={loading}
        >
          <span>{loading ? 'AGUARDE' : 'PLAY'}</span>
        </button>

        <p className="intro-error" role="status" aria-live="polite">
          {error}
        </p>
      </section>

      <div className="intro-footer">
        <p>Do seu maior fã, para a maior fã da Taylor. Te amo!</p>
        <span>Tadeu</span>
      </div>
    </main>
  )
}
