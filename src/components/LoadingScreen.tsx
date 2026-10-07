export function LoadingScreen() {
  return (
    <main className="loading-screen" aria-live="polite" aria-busy="true">
      <div className="loading-orbit" aria-hidden="true">
        <span />
      </div>

      <div className="loading-copy">
        <small>SWIFTER LYRICS</small>
        <strong>Preparando uma música…</strong>
      </div>
    </main>
  )
}
