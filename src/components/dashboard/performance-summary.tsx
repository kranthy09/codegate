import type { CandidatePerformance } from '@/types'

interface Props {
  performance: CandidatePerformance
}

/**
 * Display candidate performance summary.
 * Shows average score, stage completion, and recommendation distribution.
 */
export function PerformanceSummary({ performance }: Props) {
  const scoreLabel = performance.average_score
    ? ['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'][
        Math.round(performance.average_score)
      ]
    : null

  const recommendationLabels: Record<string, string> = {
    strong_yes: 'Strong Yes',
    yes: 'Yes',
    neutral: 'Neutral',
    no: 'No',
    strong_no: 'Strong No',
  }

  const totalRecommendations = Object.values(performance.recommendation_counts).reduce(
    (sum, count) => sum + (count || 0),
    0,
  )

  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Performance Summary</h2>

      {/* Average Score */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Average Score</p>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-gray-900">
            {performance.average_score !== null ? performance.average_score.toFixed(1) : '—'}
          </span>
          <span className="text-sm text-gray-600">/5</span>
          {scoreLabel && <span className="text-sm font-medium text-gray-700">{scoreLabel}</span>}
        </div>
      </div>

      {/* Stage Progress */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Stage Progress</p>
        <p className="text-sm text-gray-900 font-medium">
          {performance.completed_stages} of {performance.total_stages} stages completed
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gray-900 h-2 rounded-full transition-all"
            style={{
              width: `${
                performance.total_stages > 0
                  ? Math.round((performance.completed_stages / performance.total_stages) * 100)
                  : 0
              }%`,
            }}
          />
        </div>
      </div>

      {/* Recommendation Distribution */}
      {totalRecommendations > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
            Recommendation Consensus
          </p>
          <div className="space-y-2">
            {(
              ['strong_yes', 'yes', 'neutral', 'no', 'strong_no'] as const
            ).map((rec) => {
              const count = performance.recommendation_counts[rec] || 0
              return (
                <div key={rec} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700 w-20">{recommendationLabels[rec]}</span>
                  <div className="flex-1 bg-gray-200 rounded h-6 relative">
                    {count > 0 && (
                      <div
                        className={`h-6 rounded flex items-center justify-center text-xs font-semibold text-white ${
                          rec === 'strong_yes'
                            ? 'bg-green-600'
                            : rec === 'yes'
                              ? 'bg-green-500'
                              : rec === 'neutral'
                                ? 'bg-gray-500'
                                : rec === 'no'
                                  ? 'bg-orange-500'
                                  : 'bg-red-600'
                        }`}
                        style={{ width: `${Math.max(30, (count / totalRecommendations) * 100)}%` }}
                      >
                        {count}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
