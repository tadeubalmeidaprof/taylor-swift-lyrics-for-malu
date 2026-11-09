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

// Sem sinal, o iPhone pode demorar muito para desistir de uma requisição.
// Depois deste prazo, o jogo passa a usar as músicas salvas no aparelho.
const START_TIMEOUT_MS = 7000

export async function startRandomGame(clientId?: string) {
  const { data, error } = await supabase
    .rpc('start_random_game', { p_client_id: clientId || null })
    .abortSignal(AbortSignal.timeout(START_TIMEOUT_MS))

  if (error) throw error
  return firstRow<StartGameResponse>(data as StartGameResponse[])
}

type OfflinePackRow = {
  song_id: number
  title: string
  album: string
  display_tokens: string[]
  normalized_tokens: string[]
  word_count: number
  time_limit_seconds: number
  chorus_ranges: ChorusRange[] | null
}

export async function fetchOfflinePack(clientId: string, count: number): Promise<OfflineSong[]> {
  const { data, error } = await supabase
    .rpc('get_offline_pack', { p_client_id: clientId, p_count: count })
    .abortSignal(AbortSignal.timeout(20000))

  if (error) throw error

  return ((data || []) as OfflinePackRow[]).map((row) => ({
    songId: Number(row.song_id),
    title: row.title,
    album: row.album,
    displayTokens: row.display_tokens,
    normalizedTokens: row.normalized_tokens,
    wordCount: row.word_count,
    timeLimitSeconds: row.time_limit_seconds,
    chorusRanges: row.chorus_ranges || [],
  }))
}

export async function submitLiveGuess(sessionToken: string, guess: string) {
  const { data, error } = await supabase.rpc('submit_live_guess', {
    p_session_token: sessionToken,
    p_guess: guess,
  })

  if (error) throw error
  return firstRow<SubmitGuessResponse>(data as SubmitGuessResponse[])
}

export async function giveUpGame(sessionToken: string) {
  const { error } = await supabase.rpc('give_up_game', {
    p_session_token: sessionToken,
  })

  if (error) throw error
}

export async function getGameState(sessionToken: string) {
  const { data, error } = await supabase.rpc('get_game_state_v3', {
    p_session_token: sessionToken,
  })

  if (error) throw error
  return firstRow<GetGameStateResponse>(data as GetGameStateResponse[])
}

export async function setGamePaused(sessionToken: string, paused: boolean) {
  const { data, error } = await supabase.rpc('set_game_paused', {
    p_session_token: sessionToken,
    p_paused: paused,
  })

  if (error) throw error
  return firstRow<SetGamePausedResponse>(data as SetGamePausedResponse[])
}

export async function replayGame(sessionToken: string) {
  const { data, error } = await supabase.rpc('replay_game', {
    p_session_token: sessionToken,
  })

  if (error) throw error
  return firstRow<StartGameResponse>(data as StartGameResponse[])
}
