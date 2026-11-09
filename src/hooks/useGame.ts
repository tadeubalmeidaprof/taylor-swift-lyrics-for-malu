import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchOfflinePack,
  getGameState,
  giveUpGame,
  replayGame,
  setGamePaused,
  startRandomGame,
  submitLiveGuess,
} from '../services/gameApi'
import {
  clearLocalGame,
  createLocalGame,
  expireIfNeeded,
  loadLocalGame,
  localGameToSession,
  localGiveUp,
  localGuess,
  localRemainingSeconds,
  localSetPaused,
  saveLocalGame,
  type LocalGame,
} from '../offline/localGame'
import {
  loadOfflinePack,
  markOfflineSongPlayed,
  OFFLINE_PACK_SIZE,
  pickOfflineSong,
  saveOfflinePack,
  type OfflineSong,
} from '../offline/offlinePack'
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
const PACK_REFRESH_MIN_INTERVAL_MS = 60 * 1000

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
  const [replayError, setReplayError] = useState('')
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [offlineSongCount, setOfflineSongCount] = useState(() => loadOfflinePack()?.songs.length ?? 0)
  const activityWriteRef = useRef(0)
  const localGameRef = useRef<LocalGame | null>(null)
  const lastPackRefreshRef = useRef(0)

  const markActivity = useCallback(() => {
    const now = nowTimestamp()

    if (now - activityWriteRef.current < 1000) return

    activityWriteRef.current = now
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
  }, [])

  // Atualiza a tela a partir de uma partida offline. Partidas encerradas
  // saem do armazenamento, como acontece com as partidas online.
  const applyLocalGame = useCallback((game: LocalGame) => {
    localGameRef.current = game

    if (game.status === 'active') saveLocalGame(game)
    else clearLocalGame()

    setSession(localGameToSession(game, clientId))
    setRemainingSeconds(localRemainingSeconds(game))
  }, [clientId])

  const startLocalGame = useCallback((song: OfflineSong) => {
    const game = createLocalGame(song)
    markOfflineSongPlayed(song.songId)
    localStorage.removeItem(SESSION_KEY)
    localStorage.setItem(LAST_ACTIVITY_KEY, String(nowTimestamp()))
    activityWriteRef.current = nowTimestamp()
    applyLocalGame(game)
    setPauseError('')
    setStartError('')
    setReplayError('')
  }, [applyLocalGame])

  // Com internet, baixa um pacote novo de músicas para jogar offline.
  const refreshOfflinePack = useCallback(async () => {
    if (navigator.onLine === false) return

    const now = nowTimestamp()
    if (now - lastPackRefreshRef.current < PACK_REFRESH_MIN_INTERVAL_MS) return
    lastPackRefreshRef.current = now

    try {
      const songs = await fetchOfflinePack(clientId, OFFLINE_PACK_SIZE)
      const pack = saveOfflinePack(songs)
      if (pack) setOfflineSongCount(pack.songs.length)
    } catch (error) {
      // Sem conexão estável: mantém o pacote que já estava salvo.
      lastPackRefreshRef.current = 0
      console.warn('Não foi possível atualizar as músicas offline:', error)
    }
  }, [clientId])

  useEffect(() => {
    void refreshOfflinePack()

    const handleOnline = () => void refreshOfflinePack()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [refreshOfflinePack])

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(LAST_ACTIVITY_KEY)
    clearLocalGame()
    localGameRef.current = null
    setSession(null)
    setPauseError('')
    setRemainingSeconds(0)
    setStartError('')
    setReplayError('')
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
    const savedLocal = loadLocalGame()

    if (savedLocal) {
      const game = expireIfNeeded(savedLocal)

      if (isInactive() && game.pausedAt === null) {
        clearLocalSession()
      } else {
        applyLocalGame(game)
      }
      return
    }

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
  }, [clientId, clearLocalSession, isInactive, applyLocalGame])

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

        if (session.offline) {
          const game = localGameRef.current
          if (game) applyLocalGame(expireIfNeeded(game))
          return
        }

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
  }, [session?.sessionToken, session?.expiresAt, session?.status, session?.paused, session?.offline, refreshState, applyLocalGame])

  const start = useCallback(async () => {
    if (loading) return

    setLoading(true)
    setStartError('')

    const lastOfflineSongId = localGameRef.current?.song.songId

    // Sem rede nenhuma, nem tenta o servidor: vai direto para o pacote.
    if (navigator.onLine === false) {
      const song = pickOfflineSong(lastOfflineSongId)
      setLoading(false)

      if (song) {
        startLocalGame(song)
      } else {
        setStartError('Sem internet e sem músicas salvas. Abra o jogo com internet uma vez para baixar as músicas.')
      }
      return
    }

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

      clearLocalGame()
      localGameRef.current = null
      localStorage.setItem(SESSION_KEY, data.session_token)
      localStorage.setItem(LAST_ACTIVITY_KEY, String(nowTimestamp()))
      activityWriteRef.current = nowTimestamp()
      setSession(next)
      setRemainingSeconds(data.time_limit_seconds)
      setPauseError('')
      void refreshOfflinePack()
    } catch (error) {
      console.error('Falha ao iniciar partida:', error)

      // Sinal fraco ou ausente: joga uma das músicas salvas no aparelho.
      const song = pickOfflineSong(lastOfflineSongId)
      if (song) {
        startLocalGame(song)
      } else {
        setStartError('Não consegui iniciar a partida. Toque em PLAY para tentar novamente.')
      }
    } finally {
      setLoading(false)
    }
  }, [clientId, loading, startLocalGame, refreshOfflinePack])

  const replay = useCallback(async () => {
    if (!session || !['expired', 'abandoned'].includes(session.status) || loading) return

    if (session.offline) {
      const song = localGameRef.current?.song
      if (song) {
        startLocalGame(song)
        window.scrollTo({ top: 0, behavior: 'auto' })
      }
      return
    }

    setLoading(true)
    setReplayError('')
    try {
      const data = await replayGame(session.sessionToken)
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
      window.scrollTo({ top: 0, behavior: 'auto' })
    } catch (error) {
      console.error('Não foi possível repetir a música:', error)
      setReplayError('Não foi possível repetir a música. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [session, loading])

  const guess = useCallback(async (value: string): Promise<GuessOutcome> => {
    if (!session || session.status !== 'active' || session.paused) return 'miss'

    const cleaned = value.trim()
    if (!cleaned) return 'miss'

    markActivity()

    if (session.offline) {
      const game = localGameRef.current
      if (!game) return 'error'

      const result = localGuess(game, cleaned)
      if (result.game !== game) applyLocalGame(result.game)
      return result.outcome
    }

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
  }, [session, refreshState, markActivity, applyLocalGame])

  const togglePause = useCallback(async () => {
    if (!session || session.status !== 'active' || loading || pausePending) return
    const token = session.sessionToken

    if (session.offline) {
      const game = localGameRef.current
      if (game) {
        applyLocalGame(localSetPaused(game, !session.paused))
        markActivity()
      }
      return
    }

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
  }, [session, loading, pausePending, markActivity, refreshState, applyLocalGame])

  const giveUp = useCallback(async () => {
    if (!session || session.status !== 'active' || loading) return

    markActivity()

    if (session.offline) {
      const game = localGameRef.current
      if (game) applyLocalGame(localGiveUp(game))
      return
    }

    setLoading(true)

    try {
      await giveUpGame(session.sessionToken)
      await refreshState(session.sessionToken)
      localStorage.removeItem(SESSION_KEY)
    } finally {
      setLoading(false)
    }
  }, [session, loading, refreshState, markActivity, applyLocalGame])

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
    replay,
    replayError,
    goHome,
    togglePause,
    pausePending,
    pauseError,
    offlineSongCount,
  }
}
