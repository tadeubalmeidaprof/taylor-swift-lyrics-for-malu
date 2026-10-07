import { FormEvent, useEffect, useRef, useState } from 'react'

type GuessInputProps = {
  disabled?: boolean
  message?: string
  onGuess: (value: string) => Promise<void> | void
}

export function GuessInput({ disabled, message, onGuess }: GuessInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!disabled) inputRef.current?.focus()
  }, [disabled])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const guess = value.trim()
    if (!guess || disabled) return
    setValue('')
    await onGuess(guess)
    inputRef.current?.focus()
  }

  return (
    <div className="guess-area">
      <form className="guess-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          type="text"
          inputMode="text"
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
