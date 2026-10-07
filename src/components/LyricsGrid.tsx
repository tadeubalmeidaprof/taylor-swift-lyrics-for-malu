import type { ChorusRange, GameStatus } from '../types/game'

type LyricsGridProps = {
  totalWords: number
  revealed: Map<number, string>
  chorusRanges: ChorusRange[]
  foundPositions: Set<number>
  status: GameStatus
}

const COLUMN_COUNT = 4

function isInChorus(position: number, ranges: ChorusRange[]) {
  return ranges.some((range) => position >= range.start && position <= range.end)
}

function wordSizeClass(word?: string) {
  if (!word) return ''
  if (word.length >= 14) return 'lyric-token-xlong'
  if (word.length >= 10) return 'lyric-token-long'
  return ''
}

export function LyricsGrid({
  totalWords,
  revealed,
  chorusRanges,
  foundPositions,
  status,
}: LyricsGridProps) {
  const rowsPerColumn = Math.ceil(totalWords / COLUMN_COUNT)
  const chorusStarts = new Set(chorusRanges.map((range) => range.start))

  const columns = Array.from({ length: COLUMN_COUNT }, (_, columnIndex) => {
    const start = columnIndex * rowsPerColumn + 1
    const end = Math.min(totalWords, start + rowsPerColumn - 1)

    if (start > totalWords) return []

    return Array.from({ length: end - start + 1 }, (_, index) => start + index)
  })

  return (
    <div className="lyrics-grid" aria-label="Letra da música em quatro colunas">
      {columns.map((positions, columnIndex) => (
        <div
          key={columnIndex}
          className="lyrics-column"
          aria-label={"Coluna " + (columnIndex + 1)}
        >
          {positions.map((position) => {
            const word = revealed.get(position)
            const chorus = isInChorus(position, chorusRanges)
            const startsChorus = chorusStarts.has(position)
            const missed = status === 'expired' && Boolean(word) && !foundPositions.has(position)

            return (
              <div key={position} className="lyric-stack-item">
                {startsChorus && (
                  <div className="chorus-marker" aria-label="Início do refrão">
                    (REFRÃO)
                  </div>
                )}

                <span
                  className={[
                    'lyric-token',
                    word ? 'lyric-token-revealed' : 'lyric-token-hidden',
                    chorus ? 'lyric-token-chorus' : '',
                    missed ? 'lyric-token-missed' : '',
                    wordSizeClass(word),
                  ].filter(Boolean).join(' ')}
                  title={word || undefined}
                >
                  {word || ''}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
