import { useCallback, useEffect, useMemo, useState } from 'react'
import { getGameState, giveUpGame, startRandomGame, submitLiveGuess } from '../services/gameApi'
import type {
  GameSession,
  GetGameStateResponse,
  GuessOutcome,
  RevealedWord,
} from '../types/game'
import { useStableClientId } from './useStableClientId'

const SESSION_KEY = 'swifter-lyrics-active-session'

function toMap(words: RevealedWord[]) {
  return new Map(words.map((item) => [item.position, item.word]))
}

export function useGame() {
  const clientId = useStableClientId()
  const [session, setSession] = useState<GameSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [startError, setStartError] = useState('')
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

        if (state.status !== 'active') {
          localStorage.removeItem(SESSION_KEY)
        }
      })
      .catch(() => localStorage.removeItem(SESSION_KEY))
      .finally(() => setLoading(false))
  }, [clientId])

  useEffect(() => {
    if (!session || session.status !== 'active') return

    let expiryRequested = false

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
      )

      setRemainingSeconds(remaining)

      if (remaining === 0 && !expiryRequested) {
        expiryRequested = true
        refreshState(session.sessionToken)
          .then(() => localStorage.removeItem(SESSION_KEY))
          .catch(() => {
            expiryRequested = false
          })
      }
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [session?.sessionToken, session?.expiresAt, session?.status, refreshState])

  const start = useCallback(async () => {
    if (loading) return

    setLoading(true)
    setStartError('')

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
    } catch (error) {
      console.error('Falha ao iniciar partida:', error)
      setStartError('Não consegui iniciar a partida. Toque em PLAY para tentar novamente.')
    } finally {
      setLoading(false)
    }
  }, [clientId, loading])

  const guess = useCallback(async (value: string): Promise<GuessOutcome> => {
    if (!session || session.status !== 'active') return 'miss'

    const cleaned = value.trim()
    if (!cleaned) return 'miss'

    try {
      const data = await submitLiveGuess(session.sessionToken, cleaned)

      setSession((current) => {
        if (!current) return current

        const revealed = new Map(current.revealed)
        for (const item of data.revealed || []) {
          revealed.set(item.position, item.word)
        }

        return {
          ...current,
          revealed,
          foundWords: data.found_words,
          status: data.status,
        }
      })

      setRemainingSeconds(data.time_remaining_seconds)

      if (data.status !== 'active') {
        await refreshState(session.sessionToken)
        localStorage.removeItem(SESSION_KEY)
      }

      if (data.already_guessed) return 'already'
      if (data.correct) return 'correct'
      return 'miss'
    } catch (error) {
      console.error('Falha ao verificar palavra:', error)
      return 'error'
    }
  }, [session, refreshState])

  const giveUp = useCallback(async () => {
    if (!session || session.status !== 'active' || loading) return

    setLoading(true)

    try {
      await giveUpGame(session.sessionToken)
      await refreshState(session.sessionToken)
      localStorage.removeItem(SESSION_KEY)
    } finally {
      setLoading(false)
    }
  }, [session, loading, refreshState])

  const progress = useMemo(() => {
    if (!session?.totalWords) return 0
    return Math.round((session.foundWords / session.totalWords) * 100)
  }, [session?.foundWords, session?.totalWords])

  return {
    session,
    loading,
    startError,
    remainingSeconds,
    progress,
    start,
    guess,
    giveUp,
  }
}
