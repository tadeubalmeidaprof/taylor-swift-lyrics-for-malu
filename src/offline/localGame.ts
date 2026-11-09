import type { GameSession, GameStatus, GuessOutcome } from '../types/game'
import { normalizeWord, type OfflineSong } from './offlinePack'

const LOCAL_GAME_KEY = 'swifter-lyrics-offline-game'
export const OFFLINE_TOKEN_PREFIX = 'offline:'

// Partida jogada inteiramente no aparelho. Segue as mesmas regras das
// funções do Supabase (submit_live_guess, set_game_paused, give_up_game).
export type LocalGame = {
  id: string
  song: OfflineSong
  expiresAt: number
  pausedAt: number | null
  guessedWords: string[]
  foundPositions: number[]
  status: GameStatus
}

export function isOfflineToken(token: string) {
  return token.startsWith(OFFLINE_TOKEN_PREFIX)
}

export function createLocalGame(song: OfflineSong, now = Date.now()): LocalGame {
  return {
    id: OFFLINE_TOKEN_PREFIX + crypto.randomUUID(),
    song,
    expiresAt: now + song.timeLimitSeconds * 1000,
    pausedAt: null,
    guessedWords: [],
    foundPositions: [],
    status: 'active',
  }
}

export function localRemainingSeconds(game: LocalGame, now = Date.now()) {
  const reference = game.status === 'active' && game.pausedAt !== null ? game.pausedAt : now
  return Math.max(0, Math.ceil((game.expiresAt - reference) / 1000))
}

export function expireIfNeeded(game: LocalGame, now = Date.now()): LocalGame {
  if (game.status === 'active' && game.pausedAt === null && game.expiresAt <= now) {
    return { ...game, status: 'expired' }
  }
  return game
}

export function localGuess(
  current: LocalGame,
  rawGuess: string,
  now = Date.now(),
): { game: LocalGame; outcome: GuessOutcome } {
  const game = expireIfNeeded(current, now)
  const guess = normalizeWord(rawGuess)

  if (!guess || game.status !== 'active' || game.pausedAt !== null) {
    return { game, outcome: 'miss' }
  }

  if (game.guessedWords.includes(guess)) {
    const exists = game.song.normalizedTokens.includes(guess)
    return { game, outcome: exists ? 'already' : 'miss' }
  }

  const positions: number[] = []
  game.song.normalizedTokens.forEach((token, index) => {
    if (token === guess) positions.push(index + 1)
  })

  if (positions.length === 0) return { game, outcome: 'miss' }

  const foundPositions = Array.from(new Set([...game.foundPositions, ...positions])).sort((a, b) => a - b)
  const completed = foundPositions.length >= game.song.wordCount

  return {
    game: {
      ...game,
      guessedWords: [...game.guessedWords, guess],
      foundPositions,
      status: completed ? 'completed' : 'active',
    },
    outcome: 'correct',
  }
}

export function localSetPaused(current: LocalGame, paused: boolean, now = Date.now()): LocalGame {
  const game = expireIfNeeded(current, now)
  if (game.status !== 'active') return game

  if (paused && game.pausedAt === null) {
    return { ...game, pausedAt: now }
  }

  if (!paused && game.pausedAt !== null) {
    return { ...game, expiresAt: game.expiresAt + (now - game.pausedAt), pausedAt: null }
  }

  return game
}

export function localGiveUp(current: LocalGame, now = Date.now()): LocalGame {
  const game = expireIfNeeded(current, now)
  return game.status === 'active' ? { ...game, status: 'abandoned', pausedAt: null } : game
}

export function localGameToSession(game: LocalGame, clientId: string): GameSession {
  const active = game.status === 'active'
  const revealed = new Map<number, string>()

  if (active) {
    for (const position of game.foundPositions) {
      revealed.set(position, game.song.displayTokens[position - 1])
    }
  } else {
    game.song.displayTokens.forEach((word, index) => revealed.set(index + 1, word))
  }

  return {
    sessionToken: game.id,
    clientId,
    totalWords: game.song.wordCount,
    timeLimitSeconds: game.song.timeLimitSeconds,
    expiresAt: new Date(game.expiresAt).toISOString(),
    paused: active && game.pausedAt !== null,
    chorusRanges: game.song.chorusRanges,
    foundWords: game.foundPositions.length,
    foundPositions: new Set(game.foundPositions),
    revealed,
    wrongGuesses: [],
    status: game.status,
    finalTitle: active ? null : game.song.title,
    finalAlbum: active ? null : game.song.album,
    offline: true,
  }
}

export function saveLocalGame(game: LocalGame) {
  try {
    localStorage.setItem(LOCAL_GAME_KEY, JSON.stringify(game))
  } catch (error) {
    console.warn('Não foi possível salvar a partida offline:', error)
  }
}

export function loadLocalGame(): LocalGame | null {
  try {
    const raw = localStorage.getItem(LOCAL_GAME_KEY)
    if (!raw) return null
    const game = JSON.parse(raw) as LocalGame
    if (!game?.id || !game.song || !Array.isArray(game.song.normalizedTokens)) return null
    return game
  } catch {
    return null
  }
}

export function clearLocalGame() {
  localStorage.removeItem(LOCAL_GAME_KEY)
}
