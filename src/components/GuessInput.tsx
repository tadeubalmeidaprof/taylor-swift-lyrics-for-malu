import { FormEvent, useEffect, useRef, useState } from 'react'

type GuessInputProps = {
  disabled?: boolean
  message?: string
  onGuess: (value: string) => Promise<boolean>
}

const AUTO_CHECK_DELAY = 350

export function GuessInput({ disabled, message, onGuess }: GuessInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const latestValueRef = useRef('')
  const lastCheckedRef = useRef('')

  useEffect(() => {
    if (!disabled) inputRef.current?.focus({ preventScroll: true })
  }, [disabled])

  useEffect(() => {
    latestValueRef.current = value

    const guess = value.trim()
    if (!guess || disabled || guess === lastCheckedRef.current) return

    const timer = window.setTimeout(async () => {
      lastCheckedRef.current = guess
      const accepted = await onGuess(guess)

      if (accepted && latestValueRef.current.trim() === guess) {
        latestValueRef.current = ''
        lastCheckedRef.current = ''
        setValue('')
        inputRef.current?.focus({ preventScroll: true })
      }
    }, AUTO_CHECK_DELAY)

    return () => window.clearTimeout(timer)
  }, [value, disabled, onGuess])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const guess = value.trim()
    if (!guess || disabled) return

    lastCheckedRef.current = guess
    const accepted = await onGuess(guess)

    if (accepted && latestValueRef.current.trim() === guess) {
      latestValueRef.current = ''
      lastCheckedRef.current = ''
      setValue('')
      inputRef.current?.focus({ preventScroll: true })
    }
  }

  function handleChange(nextValue: string) {
    latestValueRef.current = nextValue
    setValue(nextValue)
  }

  return (
    <div className="guess-area">
      <form className="guess-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          value={value}
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
      <div className="guess-feedback" aria-live="polite">{message}</div>
    </div>
  )
}
