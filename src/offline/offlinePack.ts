import type { ChorusRange } from '../types/game'

// Quantas músicas ficam salvas no aparelho para jogar sem internet.
export const OFFLINE_PACK_SIZE = 4

const PACK_KEY = 'swifter-lyrics-offline-pack'
const PACK_VERSION = 1

export type OfflineSong = {
  songId: number
  title: string
  album: string
  displayTokens: string[]
  normalizedTokens: string[]
  wordCount: number
  timeLimitSeconds: number
  chorusRanges: ChorusRange[]
}

export type OfflinePack = {
  version: number
  savedAt: number
  songs: OfflineSong[]
  // Músicas já jogadas offline desde que o pacote foi salvo.
  playedSongIds: number[]
}

// Mesma regra de private.normalize_word no Supabase:
// minúsculas e somente letras a-z e números.
export function normalizeWord(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function isValidSong(song: OfflineSong) {
  return (
    Number.isFinite(song.songId) &&
    Array.isArray(song.displayTokens) &&
    Array.isArray(song.normalizedTokens) &&
    song.displayTokens.length > 0 &&
    song.displayTokens.length === song.normalizedTokens.length &&
    song.timeLimitSeconds > 0
  )
}

export function loadOfflinePack(): OfflinePack | null {
  try {
    const raw = localStorage.getItem(PACK_KEY)
    if (!raw) return null

    const pack = JSON.parse(raw) as OfflinePack
    if (pack?.version !== PACK_VERSION || !Array.isArray(pack.songs)) return null

    const songs = pack.songs.filter(isValidSong)
    if (songs.length === 0) return null

    return { ...pack, songs, playedSongIds: pack.playedSongIds || [] }
  } catch {
    return null
  }
}

export function saveOfflinePack(songs: OfflineSong[]) {
  const valid = songs.filter(isValidSong)
  if (valid.length === 0) return null

  const pack: OfflinePack = {
    version: PACK_VERSION,
    savedAt: Date.now(),
    songs: valid,
    playedSongIds: [],
  }

  try {
    localStorage.setItem(PACK_KEY, JSON.stringify(pack))
    return pack
  } catch (error) {
    console.warn('Não foi possível salvar as músicas offline:', error)
    return null
  }
}

export function markOfflineSongPlayed(songId: number) {
  const pack = loadOfflinePack()
  if (!pack || pack.playedSongIds.includes(songId)) return

  pack.playedSongIds = [...pack.playedSongIds, songId]

  try {
    localStorage.setItem(PACK_KEY, JSON.stringify(pack))
  } catch {
    // Sem espaço: a próxima música pode repetir, o que não impede o jogo.
  }
}

// Escolhe uma música ainda não jogada. Quando todas já foram jogadas,
// recomeça o pacote, evitando repetir a última música em seguida.
export function pickOfflineSong(excludeSongId?: number): OfflineSong | null {
  const pack = loadOfflinePack()
  if (!pack) return null

  const unplayed = pack.songs.filter((song) => !pack.playedSongIds.includes(song.songId))
  const pool = unplayed.length > 0
    ? unplayed
    : pack.songs.filter((song) => song.songId !== excludeSongId)

  const choices = pool.length > 0 ? pool : pack.songs
  return choices[Math.floor(Math.random() * choices.length)] ?? null
}
