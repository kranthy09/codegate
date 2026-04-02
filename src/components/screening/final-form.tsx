'use client'

import { useScreening } from '@/hooks/use-screening'
import type { Recommendation } from '@/types'

interface Props {
  onSubmit: () => void
  isSubmitting: boolean
}

const RECOMMENDATIONS: { value: Recommendation; label: string; description: string }[] = [
  { value: 'strong_yes', label: 'Strong Yes', description: 'Highly recommend advancing' },
  { value: 'yes', label: 'Yes', description: 'Recommend advancing' },
  { value: 'neutral', label: 'Neutral', description: 'Could go either way' },
  { value: 'no', label: 'No', description: 'Do not recommend' },
  { value: 'strong_no', label: 'Strong No', description: 'Strongly recommend against' },
]

/**
 * Final form for overall score, recommendation, and notes.
 * Requires all fields to be filled before submit is enabled.
 */
export function FinalForm({ onSubmit, isSubmitting }: Props) {
  const { overallScore, recommendation, overallNotes, setOverallScore, setRecommendation, setOverallNotes } = useScreening()

  const isComplete = overallScore !== null && recommendation !== null

  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Final Assessment</h2>

      {/* Overall Score */}
      <div>
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-3">
          Overall Score
        </p>
        <div className="flex gap-2">
          {([1, 2, 3, 4, 5] as const).map((v) => (
            <button
              key={v}
              onClick={() => setOverallScore(v)}
              disabled={isSubmitting}
              className={`w-10 h-10 rounded-full border-2 font-semibold text-sm transition-all ${
                overallScore === v
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 text-gray-600 hover:border-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {overallScore !== null && (
          <p className="text-xs text-gray-500 mt-2">
            {['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'][overallScore]}
          </p>
        )}
      </div>

      {/* Recommendation */}
      <div>
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-3">
          Recommendation
        </p>
        <select
          value={recommendation ?? ''}
          onChange={(e) => setRecommendation(e.target.value as Recommendation)}
          disabled={isSubmitting}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select recommendation…</option>
          {RECOMMENDATIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label} — {r.description}
            </option>
          ))}
        </select>
      </div>

      {/* Overall Notes */}
      <div>
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-2">
          Overall Notes
        </p>
        <textarea
          value={overallNotes}
          onChange={(e) => setOverallNotes(e.target.value)}
          disabled={isSubmitting}
          placeholder="Add final thoughts, strengths, areas for improvement…"
          rows={4}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 placeholder:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Submit Button */}
      <button
        onClick={onSubmit}
        disabled={!isComplete || isSubmitting}
        className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition-all ${
          isComplete && !isSubmitting
            ? 'bg-gray-900 text-white hover:bg-gray-800'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isSubmitting ? 'Submitting…' : 'Submit Review'}
      </button>
    </div>
  )
}
