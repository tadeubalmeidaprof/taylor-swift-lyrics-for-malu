import { supabase } from '../lib/supabase'
import type { OfflineSong } from '../offline/offlinePack'
import type {
  ChorusRange,
  GetGameStateResponse,
  StartGameResponse,
  SubmitGuessResponse,
  SetGamePausedResponse,
} from '../types/game'

function firstRow<T>(data: T[] | T | null): T {
  if (!data) throw new Error('Resposta vazia do servidor.')
  return Array.isArray(data) ? data[0] : data
}

// Com sinal fraco, o iPhone pode demorar muito para desistir de uma
// requisição. Depois destes prazos, o jogo continua no aparelho.
const START_TIMEOUT_MS = 7000
const ACTION_TIMEOUT_MS = 6000
const DOWNLOAD_TIMEOUT_MS = 20000

// Erros do banco (partida não encontrada etc.) vêm com um código do Postgres.
// Falhas de conexão e tempo esgotado chegam sem código.
export function isConnectionError(error: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const code = (error as { code?: unknown } | null)?.code
  return !(typeof code === 'string' && code.length > 0)
}

export async function startRandomGame(clientId?: string) {
  const { data, error } = await supabase
    .rpc('start_random_game', { p_client_id: clientId || null })
    .abortSignal(AbortSignal.timeout(START_TIMEOUT_MS))

  if (error) throw error
  return firstRow<StartGameResponse>(data as StartGameResponse[])
}

type SongRow = {
  song_id: number
  title: string
  album: string
  display_tokens: string[]
  normalized_tokens: string[]
  word_count: number
  time_limit_seconds: number
  chorus_ranges: ChorusRange[] | null
}

function toOfflineSong(row: SongRow): OfflineSong {
  return {
    songId: Number(row.song_id),
    title: row.title,
    album: row.album,
    displayTokens: row.display_tokens,
    normalizedTokens: row.normalized_tokens,
    wordCount: row.word_count,
    timeLimitSeconds: row.time_limit_seconds,
    chorusRanges: row.chorus_ranges || [],
  }
}

export async function fetchOfflinePack(clientId: string, count: number): Promise<OfflineSong[]> {
  const { data, error } = await supabase
    .rpc('get_offline_pack', { p_client_id: clientId, p_count: count })
    .abortSignal(AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS))

  if (error) throw error
  return ((data || []) as SongRow[]).map(toOfflineSong)
}

// Música da partida online em andamento, guardada para continuar sem sinal.
export async function fetchSessionSong(sessionToken: string): Promise<OfflineSong | null> {
  const { data, error } = await supabase
    .rpc('get_session_song', { p_session_token: sessionToken })
    .abortSignal(AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS))

  if (error) throw error
  const rows = (data || []) as SongRow[]
  return rows.length > 0 ? toOfflineSong(rows[0]) : null
}

export async function submitLiveGuess(sessionToken: string, guess: string) {
  const { data, error } = await supabase
    .rpc('submit_live_guess', { p_session_token: sessionToken, p_guess: guess })
    .abortSignal(AbortSignal.timeout(ACTION_TIMEOUT_MS))

  if (error) throw error
  return firstRow<SubmitGuessResponse>(data as SubmitGuessResponse[])
}

export async function giveUpGame(sessionToken: string) {
  const { error } = await supabase
    .rpc('give_up_game', { p_session_token: sessionToken })
    .abortSignal(AbortSignal.timeout(ACTION_TIMEOUT_MS))

  if (error) throw error
}

export async function getGameState(sessionToken: string) {
  const { data, error } = await supabase
    .rpc('get_game_state_v3', { p_session_token: sessionToken })
    .abortSignal(AbortSignal.timeout(ACTION_TIMEOUT_MS))

  if (error) throw error
  return firstRow<GetGameStateResponse>(data as GetGameStateResponse[])
}

export async function setGamePaused(sessionToken: string, paused: boolean) {
  const { data, error } = await supabase
    .rpc('set_game_paused', { p_session_token: sessionToken, p_paused: paused })
    .abortSignal(AbortSignal.timeout(ACTION_TIMEOUT_MS))

  if (error) throw error
  return firstRow<SetGamePausedResponse>(data as SetGamePausedResponse[])
}

export async function replayGame(sessionToken: string) {
  const { data, error } = await supabase
    .rpc('replay_game', { p_session_token: sessionToken })
    .abortSignal(AbortSignal.timeout(START_TIMEOUT_MS))

  if (error) throw error
  return firstRow<StartGameResponse>(data as StartGameResponse[])
}
