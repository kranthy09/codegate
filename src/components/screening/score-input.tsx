'use client'

import { useScreening } from '@/hooks/use-screening'
import { scoreLabel } from '@/lib/utils'

interface Props {
  questionId: string
}

export function ScoreInput({ questionId }: Props) {
  const { scores, notes, setScore, setNotes } = useScreening()
  const score = scores[questionId]
  const note = notes[questionId] ?? ''

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Score</p>
        <div className="flex gap-2">
          {([1, 2, 3, 4, 5] as const).map((v) => (
            <button
              key={v}
              onClick={() => setScore(questionId, v)}
              className={`w-9 h-9 rounded-full border text-sm font-medium transition-colors ${
                score === v
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 text-gray-600 hover:border-gray-600 hover:text-gray-900'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {score !== undefined && (
          <p className="text-xs text-gray-400 mt-1">{scoreLabel(score)}</p>
        )}
      </div>

      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
        <textarea
          value={note}
          onChange={(e) => setNotes(questionId, e.target.value)}
          rows={3}
          placeholder="Add interview notes…"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 placeholder:text-gray-300"
        />
      </div>
    </div>
  )
}
