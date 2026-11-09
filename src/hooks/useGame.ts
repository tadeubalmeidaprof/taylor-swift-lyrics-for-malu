import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchOfflinePack,
  fetchSessionSong,
  getGameState,
  isConnectionError,
  giveUpGame,
  replayGame,
  setGamePaused,
  startRandomGame,
  submitLiveGuess,
} from '../services/gameApi'
import {
  clearLocalGame,
  clearOnlineCopy,
  createLocalGame,
  expireIfNeeded,
  loadLocalGame,
  loadOnlineCopy,
  localGameFromOnlineCopy,
  localGameToSession,
  saveOnlineCopy,
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
  // Música da partida online atual, guardada para continuar sem internet.
  const sessionSongRef = useRef<{ token: string; song: OfflineSong } | null>(null)
  const sessionSongPendingRef = useRef<string | null>(null)
  const remainingRef = useRef(0)
  const [sessionSongVersion, setSessionSongVersion] = useState(0)

  useEffect(() => {
    remainingRef.current = remainingSeconds
  }, [remainingSeconds])

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

  const songForSession = useCallback((token: string) => {
    if (sessionSongRef.current?.token === token) return sessionSongRef.current.song
    return loadOnlineCopy(token)?.song ?? null
  }, [])

  // Assim que a partida online começa, baixa a música dela para o aparelho.
  const cacheSessionSong = useCallback(async (token: string) => {
    if (sessionSongRef.current?.token === token || sessionSongPendingRef.current === token) return
    sessionSongPendingRef.current = token

    try {
      const song = await fetchSessionSong(token)
      if (song) {
        sessionSongRef.current = { token, song }
        setSessionSongVersion((version) => version + 1)
      }
    } catch (error) {
      console.warn('Não foi possível guardar a música da partida:', error)
    } finally {
      if (sessionSongPendingRef.current === token) sessionSongPendingRef.current = null
    }
  }, [])

  // A internet caiu no meio de uma partida online: continua a mesma partida
  // no aparelho, com as palavras encontradas e o tempo restante.
  const continueOffline = useCallback((current: GameSession): LocalGame | null => {
    const song = songForSession(current.sessionToken)
    if (!song) return null

    const game = localGameFromOnlineCopy({
      sessionToken: current.sessionToken,
      song,
      foundPositions: [...current.foundPositions],
      expiresAt: new Date(current.expiresAt).getTime(),
      paused: current.paused,
      pausedRemainingSeconds: remainingRef.current,
      status: current.status,
    })

    localStorage.removeItem(SESSION_KEY)
    clearOnlineCopy()
    sessionSongRef.current = null
    applyLocalGame(game)
    return game
  }, [songForSession, applyLocalGame])

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(LAST_ACTIVITY_KEY)
    clearLocalGame()
    clearOnlineCopy()
    localGameRef.current = null
    sessionSongRef.current = null
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

        const copy = loadOnlineCopy(saved)
        if (copy) sessionSongRef.current = { token: saved, song: copy.song }
        else if (state.status === 'active') void cacheSessionSong(saved)

        if (state.status !== 'active') {
          localStorage.removeItem(SESSION_KEY)
        }
      })
      .catch((error) => {
        // Abriu sem internet no meio de uma partida online: continua no aparelho.
        const copy = isConnectionError(error) ? loadOnlineCopy(saved) : null

        if (copy && copy.status === 'active' && !(isInactive() && !copy.paused)) {
          localStorage.removeItem(SESSION_KEY)
          clearOnlineCopy()
          applyLocalGame(expireIfNeeded(localGameFromOnlineCopy(copy)))
          return
        }

        clearLocalSession()
      })
      .finally(() => setLoading(false))
  }, [clientId, clearLocalSession, isInactive, applyLocalGame, cacheSessionSong])

  // Mantém uma cópia atualizada da partida online no aparelho, para o caso
  // de o jogo ser reaberto sem internet.
  useEffect(() => {
    if (!session || session.offline) return
    const song = sessionSongRef.current?.token === session.sessionToken
      ? sessionSongRef.current.song
      : null
    if (!song) return

    saveOnlineCopy({
      sessionToken: session.sessionToken,
      song,
      foundPositions: [...session.foundPositions],
      expiresAt: new Date(session.expiresAt).getTime(),
      paused: session.paused,
      pausedRemainingSeconds: remainingRef.current,
      status: session.status,
    })
  }, [session, sessionSongVersion])

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
          .catch((error) => {
            // Sem internet quando o tempo acabou: encerra no aparelho e
            // revela a letra guardada.
            const game = isConnectionError(error) ? continueOffline(session) : null
            if (game) applyLocalGame(expireIfNeeded(game))
            else expiryRequested = false
          })
      }
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [session?.sessionToken, session?.expiresAt, session?.status, session?.paused, session?.offline, refreshState, applyLocalGame, continueOffline])

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
      clearOnlineCopy()
      localGameRef.current = null
      sessionSongRef.current = null
      localStorage.setItem(SESSION_KEY, data.session_token)
      localStorage.setItem(LAST_ACTIVITY_KEY, String(nowTimestamp()))
      activityWriteRef.current = nowTimestamp()
      setSession(next)
      setRemainingSeconds(data.time_limit_seconds)
      setPauseError('')
      void cacheSessionSong(data.session_token)
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
  }, [clientId, loading, startLocalGame, refreshOfflinePack, cacheSessionSong])

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

      const previousSong = songForSession(session.sessionToken)
      clearOnlineCopy()
      localGameRef.current = null
      sessionSongRef.current = previousSong ? { token: data.session_token, song: previousSong } : null
      localStorage.setItem(SESSION_KEY, data.session_token)
      localStorage.setItem(LAST_ACTIVITY_KEY, String(nowTimestamp()))
      activityWriteRef.current = nowTimestamp()
      setSession(next)
      setRemainingSeconds(data.time_limit_seconds)
      setPauseError('')
      setSessionSongVersion((version) => version + 1)
      if (!previousSong) void cacheSessionSong(data.session_token)
      window.scrollTo({ top: 0, behavior: 'auto' })
    } catch (error) {
      console.error('Não foi possível repetir a música:', error)

      // Sem internet: repete a mesma música no aparelho.
      const song = isConnectionError(error) ? songForSession(session.sessionToken) : null
      if (song) {
        startLocalGame(song)
        window.scrollTo({ top: 0, behavior: 'auto' })
      } else {
        setReplayError('Não foi possível repetir a música. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }, [session, loading, songForSession, cacheSessionSong, startLocalGame])

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

      if (session.status === 'active' && !songForSession(session.sessionToken)) {
        void cacheSessionSong(session.sessionToken)
      }

      if (data.already_guessed) return 'already'
      if (data.correct) return 'correct'
      return 'miss'
    } catch (error) {
      console.error('Falha ao verificar palavra:', error)
      if (!isConnectionError(error)) return 'error'

      // A internet caiu enquanto ela digitava: segue a mesma música no
      // aparelho e confere esta palavra localmente.
      const game = localGameRef.current ?? continueOffline(session)
      if (!game) return 'error'

      const result = localGuess(game, cleaned)
      if (result.game !== game) applyLocalGame(result.game)
      return result.outcome
    }
  }, [session, refreshState, markActivity, applyLocalGame, continueOffline, songForSession, cacheSessionSong])

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

      const game = isConnectionError(error) ? continueOffline(session) : null
      if (game) {
        applyLocalGame(localSetPaused(game, !session.paused))
        markActivity()
      } else {
        setPauseError('Não foi possível mudar a pausa. Tente novamente.')
      }
    } finally {
      setPausePending(false)
    }
  }, [session, loading, pausePending, markActivity, refreshState, applyLocalGame, continueOffline])

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
    } catch (error) {
      console.error('Não foi possível desistir:', error)

      // Sem internet: revela a letra guardada no aparelho.
      const game = isConnectionError(error) ? continueOffline(session) : null
      if (game) applyLocalGame(localGiveUp(game))
    } finally {
      setLoading(false)
    }
  }, [session, loading, refreshState, markActivity, applyLocalGame, continueOffline])

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
