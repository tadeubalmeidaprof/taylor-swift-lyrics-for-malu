import { supabase } from '../lib/supabase'
import type {
  GetGameStateResponse,
  StartGameResponse,
  SubmitGuessResponse,
  SetGamePausedResponse,
} from '../types/game'

function firstRow<T>(data: T[] | T | null): T {
  if (!data) throw new Error('Resposta vazia do servidor.')
  return Array.isArray(data) ? data[0] : data
}

export async function startRandomGame(clientId?: string) {
  const { data, error } = await supabase.rpc('start_random_game', {
    p_client_id: clientId || null,
  })

  if (error) throw error
  return firstRow<StartGameResponse>(data as StartGameResponse[])
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
