import type { Screening, ScreeningType } from '@/types'

interface Props {
  screenings: Screening[]
  screeningTypes: ScreeningType[]
}

/**
 * Display candidate pipeline stages with visual progression.
 * Shows each stage in order with status: completed ✓, in progress ●, scheduled ○
 */
export function PipelineStages({ screenings, screeningTypes }: Props) {
  // Build a map of screening_type_id -> ScreeningType for quick lookup
  const typeMap = new Map(screeningTypes.map((st) => [st.id, st]))

  // Create a sorted list of stages based on ScreeningType.stage_order
  const stagesWithStatus = screeningTypes
    .sort((a, b) => a.stage_order - b.stage_order)
    .map((type) => {
      const screening = screenings.find((s) => s.screening_type_id === type.id)
      return {
        type,
        screening,
        status: screening?.status || 'missing',
      }
    })

  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Pipeline Stages</h2>

      <div className="space-y-3">
        {stagesWithStatus.map((stage, index) => {
          const isCompleted = stage.status === 'completed'
          const isInProgress = stage.status === 'in_progress'
          const isScheduled = stage.status === 'scheduled'
          const isMissing = stage.status === 'missing'

          return (
            <div key={stage.type.id} className="flex items-center gap-3">
              {/* Status Badge */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                  isCompleted
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : isInProgress
                      ? 'bg-amber-100 text-amber-700 border border-amber-300'
                      : isScheduled
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-400 border border-gray-300'
                }`}
              >
                {isCompleted ? '✓' : isInProgress ? '●' : '○'}
              </div>

              {/* Stage Name and Info */}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{stage.type.name}</p>
                {stage.screening && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                    {stage.screening.overall_score !== null && (
                      <span>Score: {stage.screening.overall_score}/5</span>
                    )}
                    {stage.screening.recommendation && (
                      <span className="capitalize">
                        {stage.screening.recommendation.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Stage Order Indicator (visual) */}
              {index < stagesWithStatus.length - 1 && (
                <div className="text-gray-300 text-xs">→</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
