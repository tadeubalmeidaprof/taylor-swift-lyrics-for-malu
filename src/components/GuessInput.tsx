import { FormEvent, useEffect, useRef, useState } from 'react'
import type { GuessOutcome } from '../types/game'

type GuessInputProps = {
  disabled?: boolean
  paused?: boolean
  onGuess: (value: string) => Promise<GuessOutcome>
  onGiveUp: () => void
}

const AUTO_CHECK_DELAY = 80
const FEEDBACK_DURATION = 520
// Treme o campo quando a palavra não está na música, mas só depois que ela
// para de digitar, para não tremer a cada letra no meio da palavra.
const MISS_SHAKE_DELAY = 1000
const SHAKE_DURATION = 420

export function GuessInput({ disabled, paused, onGuess, onGiveUp }: GuessInputProps) {
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState<GuessOutcome | null>(null)
  const [composing, setComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const latestValueRef = useRef('')
  const versionRef = useRef(0)
  const feedbackTimerRef = useRef<number | null>(null)
  const [shaking, setShaking] = useState(false)
  const missTimerRef = useRef<number | null>(null)
  const shakeTimerRef = useRef<number | null>(null)

  function cancelMissShake() {
    if (missTimerRef.current !== null) {
      window.clearTimeout(missTimerRef.current)
      missTimerRef.current = null
    }
  }

  function shake() {
    if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current)
    setShaking(false)
    window.requestAnimationFrame(() => setShaking(true))
    shakeTimerRef.current = window.setTimeout(() => setShaking(false), SHAKE_DURATION)
  }

  // No celular, abre o teclado apenas ao tocar no campo. No computador,
  // dá foco sem mover a posição da letra que a pessoa está lendo.
  useEffect(() => {
    if (!disabled && !paused && window.matchMedia('(pointer: fine)').matches) {
      inputRef.current?.focus({ preventScroll: true })
    }
  }, [disabled, paused])

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current)
      }
      if (missTimerRef.current !== null) window.clearTimeout(missTimerRef.current)
      if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current)
    }
  }, [])

  function showFeedback(outcome: GuessOutcome) {
    if (outcome === 'miss') return

    setFeedback(outcome)
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current)

    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null)
    }, FEEDBACK_DURATION)
  }

  async function checkGuess(guess: string, requestVersion: number, submitted = false) {
    const outcome = await onGuess(guess)
    if (requestVersion !== versionRef.current) return

    showFeedback(outcome)

    if (outcome === 'miss') {
      cancelMissShake()
      if (submitted) {
        shake()
      } else {
        missTimerRef.current = window.setTimeout(() => {
          missTimerRef.current = null
          if (requestVersion === versionRef.current) shake()
        }, MISS_SHAKE_DELAY)
      }
    }

    if ((outcome === 'correct' || outcome === 'already') && latestValueRef.current.trim() === guess) {
      versionRef.current += 1
      latestValueRef.current = ''
      setValue('')
    }
  }

  useEffect(() => {
    const guess = value.trim()
    if (!guess || disabled || paused || composing) return

    const requestVersion = versionRef.current
    const timer = window.setTimeout(() => {
      void checkGuess(guess, requestVersion)
    }, AUTO_CHECK_DELAY)

    return () => window.clearTimeout(timer)
  }, [value, disabled, paused, composing])

  function handleChange(nextValue: string) {
    cancelMissShake()
    versionRef.current += 1
    latestValueRef.current = nextValue
    setValue(nextValue)
  }

  function clearWord() {
    cancelMissShake()
    versionRef.current += 1
    latestValueRef.current = ''
    setValue('')
    setFeedback(null)

    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }

    inputRef.current?.focus({ preventScroll: true })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const guess = value.trim()
    if (!guess || disabled || paused || composing) return
    await checkGuess(guess, versionRef.current, true)
  }

  return (
    <div className="guess-area">
      <div className="guess-toolbar">
        <div className="guess-main">
          <form className={'guess-form' + (shaking ? ' guess-form-shake' : '')} onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={value}
              onChange={(event) => handleChange(event.target.value)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={(event) => {
                setComposing(false)
                handleChange(event.currentTarget.value)
              }}
              type="text"
              inputMode="text"
              enterKeyHint="go"
              autoComplete="off"
              autoCorrect="on"
              autoCapitalize="none"
              spellCheck
              placeholder={paused ? 'Partida pausada' : 'Digite uma palavra'}
              disabled={disabled || paused}
              aria-label="Digite uma palavra da música"
            />

            {value.length > 0 && !paused && !disabled && (
              <button
                type="button"
                className="clear-guess-button"
                aria-label="Apagar palavra digitada"
                title="Apagar palavra"
                onPointerDown={(event) => event.preventDefault()}
                onClick={clearWord}
              >
                ×
              </button>
            )}
          </form>

          {feedback && feedback !== 'miss' && !paused && (
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
          disabled={disabled || paused}
        >
          Desistir
        </button>
      </div>
    </div>
  )
}
