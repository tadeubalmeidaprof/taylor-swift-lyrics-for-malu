export type ChorusRange = {
  start: number
  end: number
}

export type RevealedWord = {
  position: number
  word: string
}

export type GameStatus = 'active' | 'completed' | 'expired' | 'abandoned'
export type GuessOutcome = 'correct' | 'already' | 'miss' | 'error'

export type GameSession = {
  sessionToken: string
  clientId: string
  totalWords: number
  timeLimitSeconds: number
  expiresAt: string
  paused: boolean
  chorusRanges: ChorusRange[]
  foundWords: number
  foundPositions: Set<number>
  revealed: Map<number, string>
  wrongGuesses: string[]
  status: GameStatus
  finalTitle?: string | null
  finalAlbum?: string | null
}

export type StartGameResponse = {
  session_token: string
  client_id: string
  total_words: number
  time_limit_seconds: number
  expires_at: string
  chorus_ranges: ChorusRange[]
}

export type SubmitGuessResponse = {
  status: GameStatus
  correct: boolean
  already_guessed: boolean
  matched_count: number
  found_words: number
  total_words: number
  time_remaining_seconds: number
  revealed: RevealedWord[]
}

export type GetGameStateResponse = {
  status: GameStatus
  found_words: number
  found_positions: number[]
  total_words: number
  time_limit_seconds: number
  time_remaining_seconds: number
  chorus_ranges: ChorusRange[]
  revealed: RevealedWord[]
  wrong_guesses: string[]
  final_title: string | null
  final_album: string | null
  paused: boolean
  expires_at: string
}

export type SetGamePausedResponse = {
  status: GameStatus
  paused: boolean
  time_remaining_seconds: number
  expires_at: string
}
