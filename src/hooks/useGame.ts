import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getGameState, giveUpGame, setGamePaused, startRandomGame, submitLiveGuess } from '../services/gameApi'
import type {
  GameSession,
  GetGameStateResponse,
  GuessOutcome,
  RevealedWord,
} from '../types/game'
import { useStableClientId } from './useStableClientId'

const SESSION_KEY = 'swifter-lyrics-active-session'
const LAST_ACTIVITY_KEY = 'swifter-lyrics-last-activity'
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000
const INACTIVITY_CHECK_MS = 30 * 1000

function toMap(words: RevealedWord[]) {
  return new Map(words.map((item) => [item.position, item.word]))
}

function nowTimestamp() {
  return Date.now()
}

export function useGame() {
  const clientId = useStableClientId()
  const [session, setSession] = useState<GameSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [pausePending, setPausePending] = useState(false)
  const [pauseError, setPauseError] = useState('')
  const [startError, setStartError] = useState('')
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const activityWriteRef = useRef(0)

  const markActivity = useCallback(() => {
    const now = nowTimestamp()

    if (now - activityWriteRef.current < 1000) return

    activityWriteRef.current = now
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
  }, [])

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(LAST_ACTIVITY_KEY)
    setSession(null)
    setPauseError('')
    setRemainingSeconds(0)
    setStartError('')
  }, [])

  const isInactive = useCallback(() => {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY)
    if (!raw) return true

    const lastActivity = Number(raw)
    if (!Number.isFinite(lastActivity)) return true

    return nowTimestamp() - lastActivity >= INACTIVITY_TIMEOUT_MS
  }, [])

  const refreshState = useCallback(async (sessionToken: string) => {
    const state = await getGameState(sessionToken)

    setSession((current) => {
      if (!current) return current

      return {
        ...current,
        status: state.status,
        paused: state.paused,
        expiresAt: state.expires_at,
        foundWords: state.found_words,
        foundPositions: new Set(state.found_positions || []),
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

    // Uma partida pausada continua válida mesmo após 15 minutos sem interação.
    // Consultamos o servidor antes de descartar uma sessão restaurada.
    setLoading(true)

    getGameState(saved)
      .then((state: GetGameStateResponse) => {
        if (isInactive() && !state.paused) {
          clearLocalSession()
          return
        }

        setSession({
          sessionToken: saved,
          clientId,
          totalWords: state.total_words,
          timeLimitSeconds: state.time_limit_seconds,
          expiresAt: state.expires_at,
          paused: state.paused,
          chorusRanges: state.chorus_ranges || [],
          foundWords: state.found_words,
          foundPositions: new Set(state.found_positions || []),
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
      .catch(() => clearLocalSession())
      .finally(() => setLoading(false))
  }, [clientId, clearLocalSession, isInactive])

  useEffect(() => {
    if (!session) return

    const handleInteraction = () => {
      markActivity()
    }

    const checkInactivity = () => {
      if (!session.paused && isInactive()) {
        clearLocalSession()
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity()
      }
    }

    window.addEventListener('pointerdown', handleInteraction, { passive: true })
    window.addEventListener('keydown', handleInteraction)
    window.addEventListener('touchstart', handleInteraction, { passive: true })
    window.addEventListener('focus', checkInactivity)
    document.addEventListener('visibilitychange', handleVisibility)

    const id = window.setInterval(checkInactivity, INACTIVITY_CHECK_MS)

    return () => {
      window.removeEventListener('pointerdown', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
      window.removeEventListener('focus', checkInactivity)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(id)
    }
  }, [session, markActivity, isInactive, clearLocalSession])

  useEffect(() => {
    if (!session || session.status !== 'active') return

    let expiryRequested = false

    const tick = () => {
      if (session.paused) return

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
  }, [session?.sessionToken, session?.expiresAt, session?.status, session?.paused, refreshState])

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
        paused: false,
        chorusRanges: data.chorus_ranges || [],
        foundWords: 0,
        foundPositions: new Set(),
        revealed: new Map(),
        wrongGuesses: [],
        status: 'active',
      }

      localStorage.setItem(SESSION_KEY, data.session_token)
      localStorage.setItem(LAST_ACTIVITY_KEY, String(nowTimestamp()))
      activityWriteRef.current = nowTimestamp()
      setSession(next)
      setRemainingSeconds(data.time_limit_seconds)
      setPauseError('')
    } catch (error) {
      console.error('Falha ao iniciar partida:', error)
      setStartError('Não consegui iniciar a partida. Toque em PLAY para tentar novamente.')
    } finally {
      setLoading(false)
    }
  }, [clientId, loading])

  const guess = useCallback(async (value: string): Promise<GuessOutcome> => {
    if (!session || session.status !== 'active' || session.paused) return 'miss'

    const cleaned = value.trim()
    if (!cleaned) return 'miss'

    markActivity()

    try {
      const data = await submitLiveGuess(session.sessionToken, cleaned)

      setSession((current) => {
        if (!current) return current

        const revealed = new Map(current.revealed)
        const foundPositions = new Set(current.foundPositions)

        for (const item of data.revealed || []) {
          revealed.set(item.position, item.word)
          foundPositions.add(item.position)
        }

        return {
          ...current,
          revealed,
          foundPositions,
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
  }, [session, refreshState, markActivity])

  const togglePause = useCallback(async () => {
    if (!session || session.status !== 'active' || loading || pausePending) return
    const token = session.sessionToken

    setPausePending(true)
    setPauseError('')
    try {
      const result = await setGamePaused(token, !session.paused)
      setSession((current) => {
        if (!current || current.sessionToken !== token) return current
        return {
          ...current,
          status: result.status,
          paused: result.paused,
          expiresAt: result.expires_at,
        }
      })
      setRemainingSeconds(result.time_remaining_seconds)
      markActivity()

      if (result.status !== 'active') {
        await refreshState(token)
        localStorage.removeItem(SESSION_KEY)
      }
    } catch (error) {
      console.error('Erro ao pausar ou retomar:', error)
      setPauseError('Não foi possível mudar a pausa. Tente novamente.')
    } finally {
      setPausePending(false)
    }
  }, [session, loading, pausePending, markActivity, refreshState])

  const giveUp = useCallback(async () => {
    if (!session || session.status !== 'active' || loading) return

    markActivity()
    setLoading(true)

    try {
      await giveUpGame(session.sessionToken)
      await refreshState(session.sessionToken)
      localStorage.removeItem(SESSION_KEY)
    } finally {
      setLoading(false)
    }
  }, [session, loading, refreshState, markActivity])

  const goHome = useCallback(() => {
    clearLocalSession()
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [clearLocalSession])

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
    goHome,
    togglePause,
    pausePending,
    pauseError,
  }
}
