import type { ChorusRange } from '../types/game'

type LyricsGridProps = {
  totalWords: number
  revealed: Map<number, string>
  chorusRanges: ChorusRange[]
}

function isInChorus(position: number, ranges: ChorusRange[]) {
  return ranges.some((range) => position >= range.start && position <= range.end)
}

export function LyricsGrid({ totalWords, revealed, chorusRanges }: LyricsGridProps) {
  return (
    <div className="lyrics-grid" aria-label="Letra da música escondida">
      {Array.from({ length: totalWords }, (_, index) => {
        const position = index + 1
        const word = revealed.get(position)
        const chorus = isInChorus(position, chorusRanges)

        return (
          <span
            key={position}
            className={[
              'lyric-token',
              word ? 'lyric-token-revealed' : 'lyric-token-hidden',
              chorus ? 'lyric-token-chorus' : '',
            ].filter(Boolean).join(' ')}
          >
            {word || ''}
          </span>
        )
      })}
    </div>
  )
}
