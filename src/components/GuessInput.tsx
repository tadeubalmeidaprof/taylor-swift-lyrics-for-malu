import { FormEvent, useEffect, useRef, useState } from 'react'
import type { GuessOutcome } from '../types/game'

type GuessInputProps = {
  disabled?: boolean
  onGuess: (value: string) => Promise<GuessOutcome>
  onGiveUp: () => void
}

const AUTO_CHECK_DELAY = 80
const FEEDBACK_DURATION = 520

export function GuessInput({ disabled, onGuess, onGiveUp }: GuessInputProps) {
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState<GuessOutcome | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const latestValueRef = useRef('')
  const versionRef = useRef(0)
  const feedbackTimerRef = useRef<number | null>(null)
  const focusScrollRef = useRef(0)

  useEffect(() => {
    if (disabled || !inputRef.current) return

    const previousY = window.scrollY
    inputRef.current.focus({ preventScroll: true })

    window.requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - previousY) > 4) {
        window.scrollTo({ top: previousY, behavior: 'auto' })
      }
    })
  }, [disabled])

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current)
      }
    }
  }, [])

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

  function preserveScrollBeforeFocus() {
    focusScrollRef.current = window.scrollY
  }

  function restoreScrollAfterFocus() {
    const targetY = focusScrollRef.current

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: 'auto' })
    })

    window.setTimeout(() => {
      if (document.activeElement === inputRef.current && Math.abs(window.scrollY - targetY) > 6) {
        window.scrollTo({ top: targetY, behavior: 'auto' })
      }
    }, 220)
  }

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
              onPointerDown={preserveScrollBeforeFocus}
              onTouchStart={preserveScrollBeforeFocus}
              onFocus={restoreScrollAfterFocus}
              onChange={(event) => handleChange(event.target.value)}
              type="text"
              inputMode="text"
              enterKeyHint="go"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
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
