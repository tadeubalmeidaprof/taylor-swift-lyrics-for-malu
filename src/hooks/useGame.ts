import { useCallback, useEffect, useMemo, useState } from 'react'
import { getGameState, startRandomGame, submitGuess } from '../services/gameApi'
import type { GameSession, GetGameStateResponse, RevealedWord } from '../types/game'
import { useStableClientId } from './useStableClientId'

const SESSION_KEY = 'swifter-lyrics-active-session'

function toMap(words: RevealedWord[]) {
  return new Map(words.map((item) => [item.position, item.word]))
}

export function useGame() {
  const clientId = useStableClientId()
  const [session, setSession] = useState<GameSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  const refreshState = useCallback(async (sessionToken: string) => {
    const state = await getGameState(sessionToken)

    setSession((current) => {
      if (!current) return current
      return {
        ...current,
        status: state.status,
        foundWords: state.found_words,
        totalWords: state.total_words,
        timeLimitSeconds: state.time_limit_seconds,
        chorusRanges: state.chorus_ranges || [],
        revealed: toMap(state.revealed || []),
        wrongGuesses: state.wrong_guesses || [],
        finalTitle: state.final_title,
        finalAlbum: state.final_album,
      }
    })

    setRemainingSeconds(state.time_remaining_seconds)
    return state
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY)
    if (!saved) return

    setLoading(true)
    getGameState(saved)
      .then((state: GetGameStateResponse) => {
        if (state.status !== 'active') {
          localStorage.removeItem(SESSION_KEY)
          return
        }

        setSession({
          sessionToken: saved,
          clientId,
          totalWords: state.total_words,
          timeLimitSeconds: state.time_limit_seconds,
          expiresAt: new Date(Date.now() + state.time_remaining_seconds * 1000).toISOString(),
          chorusRanges: state.chorus_ranges || [],
          foundWords: state.found_words,
          revealed: toMap(state.revealed || []),
          wrongGuesses: state.wrong_guesses || [],
          status: state.status,
          finalTitle: state.final_title,
          finalAlbum: state.final_album,
        })
        setRemainingSeconds(state.time_remaining_seconds)
      })
      .catch(() => localStorage.removeItem(SESSION_KEY))
      .finally(() => setLoading(false))
  }, [clientId])

  useEffect(() => {
    if (!session || session.status !== 'active') return

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
      )

      setRemainingSeconds(remaining)

      if (remaining === 0) {
        refreshState(session.sessionToken).catch(() => undefined)
      }
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [session?.sessionToken, session?.expiresAt, session?.status, refreshState])

  const start = useCallback(async () => {
    setLoading(true)
    setMessage('')

    try {
      const data = await startRandomGame(clientId)
      const next: GameSession = {
        sessionToken: data.session_token,
        clientId: data.client_id,
        totalWords: data.total_words,
        timeLimitSeconds: data.time_limit_seconds,
        expiresAt: data.expires_at,
        chorusRanges: data.chorus_ranges || [],
        foundWords: 0,
        revealed: new Map(),
        wrongGuesses: [],
        status: 'active',
      }

      localStorage.setItem(SESSION_KEY, data.session_token)
      setSession(next)
      setRemainingSeconds(data.time_limit_seconds)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  const guess = useCallback(async (value: string) => {
    if (!session || session.status !== 'active') return

    const cleaned = value.trim()
    if (!cleaned) return

    setMessage('')

    try {
      const data = await submitGuess(session.sessionToken, cleaned)

      setSession((current) => {
        if (!current) return current

        const revealed = new Map(current.revealed)
        for (const item of data.revealed || []) {
          revealed.set(item.position, item.word)
        }

        const wrongGuesses =
          !data.correct && !data.already_guessed
            ? Array.from(new Set([...current.wrongGuesses, cleaned]))
            : current.wrongGuesses

        return {
          ...current,
          revealed,
          wrongGuesses,
          foundWords: data.found_words,
          status: data.status,
        }
      })

      setRemainingSeconds(data.time_remaining_seconds)

      if (data.already_guessed) {
        setMessage('Você já tentou “' + cleaned + '”.')
      } else if (!data.correct) {
        setMessage('“' + cleaned + '” não aparece.')
      } else if (data.matched_count > 1) {
        setMessage('+' + data.matched_count + ' palavras reveladas')
      }

      if (data.status !== 'active') {
        await refreshState(session.sessionToken)
        localStorage.removeItem(SESSION_KEY)
      }
    } catch {
      setMessage('Não foi possível verificar essa palavra. Tente novamente.')
    }
  }, [session, refreshState])

  const reset = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setMessage('')
    setRemainingSeconds(0)
  }, [])

  const progress = useMemo(() => {
    if (!session?.totalWords) return 0
    return Math.round((session.foundWords / session.totalWords) * 100)
  }, [session?.foundWords, session?.totalWords])

  return {
    session,
    loading,
    message,
    remainingSeconds,
    progress,
    start,
    guess,
    reset,
  }
}
