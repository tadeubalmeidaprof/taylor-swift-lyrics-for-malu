import { useLayoutEffect, useRef, type ReactNode } from 'react'

export function FloatingGameControls({ children }: { children: ReactNode }) {
  const spaceRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const space = spaceRef.current
    const controls = controlsRef.current
    if (!space || !controls) return

    const viewport = window.visualViewport
    let frame: number | null = null

    function syncPosition() {
      // O teclado do iPhone pode deslocar a área visível sem rolar a página.
      // Acompanha somente esse deslocamento; o zoom continua nativo.
      const top = viewport && viewport.scale === 1 ? viewport.offsetTop : 0
      controls!.style.setProperty('--controls-viewport-top', `${Math.max(0, top)}px`)
    }

    function reserveSpace() {
      // Mede também mudanças na pausa, no resultado e na orientação da tela.
      space!.style.height = `${controls!.getBoundingClientRect().height}px`
    }

    function schedulePosition() {
      if (frame !== null) return
      frame = window.requestAnimationFrame(() => {
        frame = null
        syncPosition()
        reserveSpace()
      })
    }

    syncPosition()
    reserveSpace()

    const observer = new ResizeObserver(reserveSpace)
    observer.observe(controls)
    viewport?.addEventListener('resize', schedulePosition)
    viewport?.addEventListener('scroll', schedulePosition)
    window.addEventListener('resize', schedulePosition)

    return () => {
      observer.disconnect()
      viewport?.removeEventListener('resize', schedulePosition)
      viewport?.removeEventListener('scroll', schedulePosition)
      window.removeEventListener('resize', schedulePosition)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="game-controls-space" ref={spaceRef}>
      <div className="game-top-controls" ref={controlsRef}>
        {children}
      </div>
    </div>
  )
}
