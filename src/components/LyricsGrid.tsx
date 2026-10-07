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

function isCutInsideChorus(position: number, ranges: ChorusRange[]) {
  return ranges.some((range) => position >= range.start && position < range.end)
}

function wordSizeClass(word?: string) {
  if (!word) return ''
  if (word.length >= 14) return 'lyric-token-xlong'
  if (word.length >= 10) return 'lyric-token-long'
  return ''
}

function buildBalancedColumns(totalWords: number, chorusRanges: ChorusRange[]) {
  const chorusStarts = new Set(chorusRanges.map((range) => range.start))

  const visualCost = (start: number, end: number) => {
    let cost = 0

    for (let position = start; position <= end; position += 1) {
      cost += 1
      if (chorusStarts.has(position)) cost += 1
    }

    return cost
  }

  const columns: number[][] = []
  let start = 1

  for (let columnIndex = 0; columnIndex < COLUMN_COUNT - 1; columnIndex += 1) {
    const columnsLeft = COLUMN_COUNT - columnIndex
    const remainingWords = totalWords - start + 1
    const targetWords = remainingWords / columnsLeft
    const idealEnd = Math.round(start + targetWords - 1)

    const minEnd = Math.max(start, idealEnd - 24)
    const maxEnd = Math.min(
      totalWords - (columnsLeft - 1),
      idealEnd + 24,
    )

    const remainingVisualCost = visualCost(start, totalWords)
    const targetVisualCost = remainingVisualCost / columnsLeft

    let bestEnd = Math.min(
      totalWords - (columnsLeft - 1),
      Math.max(start, idealEnd),
    )
    let bestScore = Number.POSITIVE_INFINITY

    for (let candidate = minEnd; candidate <= maxEnd; candidate += 1) {
      const keepsChorusTogether = !isCutInsideChorus(candidate, chorusRanges)
      const nextStartsChorus = chorusStarts.has(candidate + 1)
      const candidateCost = visualCost(start, candidate)

      let score = Math.abs(candidateCost - targetVisualCost)

      if (!keepsChorusTogether) score += 100
      if (nextStartsChorus) score -= 2

      if (score < bestScore) {
        bestScore = score
        bestEnd = candidate
      }
    }

    columns.push(
      Array.from({ length: bestEnd - start + 1 }, (_, index) => start + index),
    )
    start = bestEnd + 1
  }

  columns.push(
    Array.from({ length: Math.max(0, totalWords - start + 1) }, (_, index) => start + index),
  )

  return columns
}

export function LyricsGrid({
  totalWords,
  revealed,
  chorusRanges,
  foundPositions,
  status,
}: LyricsGridProps) {
  const chorusStarts = new Set(chorusRanges.map((range) => range.start))
  const columns = buildBalancedColumns(totalWords, chorusRanges)

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
