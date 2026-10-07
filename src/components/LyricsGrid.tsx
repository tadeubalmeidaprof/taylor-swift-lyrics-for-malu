import { Fragment } from 'react'
import type { ChorusRange } from '../types/game'

type LyricsGridProps = {
  totalWords: number
  revealed: Map<number, string>
  chorusRanges: ChorusRange[]
}

function getChorusRange(position: number, ranges: ChorusRange[]) {
  return ranges.find((range) => position >= range.start && position <= range.end)
}

function wordSizeClass(word?: string) {
  if (!word) return ''
  if (word.length >= 14) return 'lyric-token-xlong'
  if (word.length >= 10) return 'lyric-token-long'
  return ''
}

export function LyricsGrid({ totalWords, revealed, chorusRanges }: LyricsGridProps) {
  const chorusStarts = new Set(chorusRanges.map((range) => range.start))

  return (
    <div className="lyrics-grid" aria-label="Letra da música">
      {Array.from({ length: totalWords }, (_, index) => {
        const position = index + 1
        const word = revealed.get(position)
        const chorus = getChorusRange(position, chorusRanges)
        const startsChorus = chorusStarts.has(position)

        return (
          <Fragment key={position}>
            {startsChorus && (
              <div className="chorus-label" aria-label="Início do refrão">
                REFRÃO
              </div>
            )}

            <span
              className={[
                'lyric-token',
                word ? 'lyric-token-revealed' : 'lyric-token-hidden',
                chorus ? 'lyric-token-chorus' : '',
                wordSizeClass(word),
              ].filter(Boolean).join(' ')}
              title={word || undefined}
            >
              {word || ''}
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}
