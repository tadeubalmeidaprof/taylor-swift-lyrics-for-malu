import { FormEvent, useEffect, useRef, useState } from 'react'
import type { GuessOutcome } from '../types/game'

type GuessInputProps = {
  disabled?: boolean
  paused?: boolean
  onGuess: (value: string) => Promise<GuessOutcome>
  // Espera em ms antes de conferir; null = não conferir sozinho.
  getDelay?: (word: string) => number | null
  onGiveUp: () => void
}

// Espera uma pausa na digitação antes de conferir. Palavras curtas esperam
// mais, porque costumam ser o começo de outra ("a" de "air", "I" de "in").
// Espaço ou Enter conferem na hora.
const SHORT_WORD_DELAY = 900
const WORD_DELAY = 450
const FEEDBACK_DURATION = 520

// A palavra conferida é sempre a última digitada. Assim, uma palavra errada
// seguida de espaço não gruda na próxima ("sky cold").
function currentWord(rawValue: string) {
  return rawValue.trim().split(/\s+/).pop() ?? ''
}

function autoCheckDelay(rawValue: string) {
  if (/\s$/.test(rawValue)) return 0
  return currentWord(rawValue).length <= 2 ? SHORT_WORD_DELAY : WORD_DELAY
}

export function GuessInput({ disabled, paused, onGuess, onGiveUp, getDelay }: GuessInputProps) {
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState<GuessOutcome | null>(null)
  const [composing, setComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const latestValueRef = useRef('')
  const versionRef = useRef(0)
  const feedbackTimerRef = useRef<number | null>(null)

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

  async function checkGuess(guess: string, requestVersion: number) {
    const outcome = await onGuess(guess)
    if (requestVersion !== versionRef.current) return

    showFeedback(outcome)

    if ((outcome === 'correct' || outcome === 'already') && currentWord(latestValueRef.current) === guess) {
      versionRef.current += 1
      latestValueRef.current = ''
      setValue('')
    }
  }

  useEffect(() => {
    const guess = currentWord(value)
    if (!guess || disabled || paused || composing) return

    const requestVersion = versionRef.current
    const typedSpace = /\s$/.test(value)
    const delay = typedSpace ? 0 : getDelay ? getDelay(guess) : autoCheckDelay(value)
    if (delay === null) return

    const timer = window.setTimeout(() => {
      void checkGuess(guess, requestVersion)
    }, delay)

    return () => window.clearTimeout(timer)
  }, [value, disabled, paused, composing])

  function handleChange(nextValue: string) {
    versionRef.current += 1
    latestValueRef.current = nextValue
    setValue(nextValue)
  }

  function clearWord() {
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
    const guess = currentWord(value)
    if (!guess || disabled || paused || composing) return
    await checkGuess(guess, versionRef.current)
  }

  return (
    <div className="guess-area">
      <div className="guess-toolbar">
        <div className="guess-main">
          <form className="guess-form" onSubmit={handleSubmit}>
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
