import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import type { GuessOutcome } from '../types/game'

type GuessInputProps = {
  disabled?: boolean
  onGuess: (value: string) => Promise<GuessOutcome>
  onGiveUp: () => void
}

const AUTO_CHECK_DELAY = 80
const FEEDBACK_DURATION = 520
const FOCUS_SCROLL_LOCK_MS = 850
const FOCUS_RESTORE_STEPS = [0, 90, 180, 320, 520, 760]

export function GuessInput({ disabled, onGuess, onGiveUp }: GuessInputProps) {
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState<GuessOutcome | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const latestValueRef = useRef('')
  const versionRef = useRef(0)
  const feedbackTimerRef = useRef<number | null>(null)
  const focusScrollRef = useRef(0)
  const focusLockUntilRef = useRef(0)
  const focusRestoreTimersRef = useRef<number[]>([])

  useEffect(() => {
    if (disabled || !inputRef.current) return

    // No mobile, o foco automático pode fazer o Safari reposicionar a página
    // ao abrir o teclado. Mantemos auto-focus apenas para mouse/trackpad.
    if (window.matchMedia('(pointer: fine)').matches) {
      inputRef.current.focus({ preventScroll: true })
    }
  }, [disabled])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const preserveScrollDuringKeyboardAnimation = () => {
      if (
        document.activeElement !== inputRef.current ||
        performance.now() > focusLockUntilRef.current
      ) {
        return
      }

      window.requestAnimationFrame(() => {
        window.scrollTo({
          top: focusScrollRef.current,
          behavior: 'auto',
        })
      })
    }

    viewport.addEventListener('resize', preserveScrollDuringKeyboardAnimation)
    viewport.addEventListener('scroll', preserveScrollDuringKeyboardAnimation)

    return () => {
      viewport.removeEventListener('resize', preserveScrollDuringKeyboardAnimation)
      viewport.removeEventListener('scroll', preserveScrollDuringKeyboardAnimation)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current)
      }

      for (const timer of focusRestoreTimersRef.current) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  function clearFocusRestoreTimers() {
    for (const timer of focusRestoreTimersRef.current) {
      window.clearTimeout(timer)
    }

    focusRestoreTimersRef.current = []
  }

  function restoreSavedScroll() {
    if (
      document.activeElement !== inputRef.current ||
      performance.now() > focusLockUntilRef.current
    ) {
      return
    }

    window.scrollTo({
      top: focusScrollRef.current,
      behavior: 'auto',
    })
  }

  function scheduleScrollRestoration() {
    clearFocusRestoreTimers()

    focusRestoreTimersRef.current = FOCUS_RESTORE_STEPS.map((delay) =>
      window.setTimeout(() => {
        restoreSavedScroll()
      }, delay),
    )
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLInputElement>) {
    if (disabled || !inputRef.current) return
    if (document.activeElement === inputRef.current) return

    focusScrollRef.current = window.scrollY
    focusLockUntilRef.current = performance.now() + FOCUS_SCROLL_LOCK_MS

    // Foco síncrono dentro do gesto: abre o teclado no iOS sem deixar o
    // Safari executar o scroll automático padrão do campo focado.
    event.preventDefault()
    inputRef.current.focus({ preventScroll: true })
    scheduleScrollRestoration()
  }

  function handleBlur() {
    focusLockUntilRef.current = 0
    clearFocusRestoreTimers()
  }

  function showFeedback(outcome: GuessOutcome) {
    if (outcome === 'miss') return

    setFeedback(outcome)

    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current)
    }

    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null)
    }, FEEDBACK_DURATION)
  }

  async function checkGuess(guess: string, requestVersion: number) {
    const outcome = await onGuess(guess)

    if (requestVersion !== versionRef.current) return

    showFeedback(outcome)

    if ((outcome === 'correct' || outcome === 'already') && latestValueRef.current.trim() === guess) {
      versionRef.current += 1
      latestValueRef.current = ''
      setValue('')
    }
  }

  useEffect(() => {
    const guess = value.trim()
    if (!guess || disabled) return

    const requestVersion = versionRef.current

    const timer = window.setTimeout(() => {
      void checkGuess(guess, requestVersion)
    }, AUTO_CHECK_DELAY)

    return () => window.clearTimeout(timer)
  }, [value, disabled])

  function handleChange(nextValue: string) {
    versionRef.current += 1
    latestValueRef.current = nextValue
    setValue(nextValue)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const guess = value.trim()
    if (!guess || disabled) return

    const requestVersion = versionRef.current
    await checkGuess(guess, requestVersion)
  }

  return (
    <div className="guess-area">
      <div className="guess-toolbar">
        <div className="guess-main">
          <form className="guess-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={value}
              onPointerDown={handlePointerDown}
              onBlur={handleBlur}
              onChange={(event) => handleChange(event.target.value)}
              type="text"
              inputMode="text"
              enterKeyHint="go"
              autoComplete="off"
              autoCorrect="on"
              autoCapitalize="none"
              spellCheck
              placeholder="Digite uma palavra"
              disabled={disabled}
              aria-label="Digite uma palavra da música"
            />
          </form>

          {feedback && feedback !== 'miss' && (
            <div
              className={[
                'guess-flash',
                feedback === 'correct' ? 'guess-flash-correct' : '',
                feedback === 'already' ? 'guess-flash-already' : '',
                feedback === 'error' ? 'guess-flash-error' : '',
              ].filter(Boolean).join(' ')}
              aria-live="polite"
            >
              {feedback === 'correct' && '✓ CORRETO'}
              {feedback === 'already' && '↺ JÁ ENCONTRADA'}
              {feedback === 'error' && 'TENTE NOVAMENTE'}
            </div>
          )}
        </div>

        <button
          className="give-up-button"
          type="button"
          onClick={onGiveUp}
          disabled={disabled}
        >
          Desistir
        </button>
      </div>
    </div>
  )
}
