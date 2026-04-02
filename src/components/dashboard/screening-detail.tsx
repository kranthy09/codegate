'use client'

import { useState } from 'react'
import type { CandidatePipelineSnapshot } from '@/types'
import { CodeHistory } from './code-history'
import { DrawingHistory } from './drawing-history'

interface Props {
  snapshot: CandidatePipelineSnapshot
  screeningTypeName: string
  interviewerName: string
}

const recommendationColors: Record<string, string> = {
  strong_yes: 'bg-green-100 text-green-800',
  yes: 'bg-green-50 text-green-700',
  neutral: 'bg-gray-100 text-gray-700',
  no: 'bg-orange-50 text-orange-700',
  strong_no: 'bg-red-100 text-red-800',
}

const recommendationLabels: Record<string, string> = {
  strong_yes: 'Strong Yes',
  yes: 'Yes',
  neutral: 'Neutral',
  no: 'No',
  strong_no: 'Strong No',
}

/**
 * Collapsible screening detail card.
 * Shows question scores, code submissions, drawings, and recommendation.
 */
export function ScreeningDetail({
  snapshot,
  screeningTypeName,
  interviewerName,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const statusLabel = {
    completed: '✓ Completed',
    in_progress: '● In Progress',
    scheduled: '○ Scheduled',
  }[snapshot.status] || snapshot.status

  const statusColor = {
    completed: 'text-green-700',
    in_progress: 'text-amber-700',
    scheduled: 'text-blue-700',
  }[snapshot.status] || 'text-gray-700'

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left transition-colors"
      >
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">{screeningTypeName}</h3>
            {snapshot.overall_score !== null && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-sm font-medium text-gray-900">
                {snapshot.overall_score}/5
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            {snapshot.recommendation && (
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  recommendationColors[snapshot.recommendation] || 'bg-gray-100 text-gray-700'
                }`}
              >
                {recommendationLabels[snapshot.recommendation]}
              </span>
            )}
            <span className={statusColor}>{statusLabel}</span>
            {interviewerName && <span>by {interviewerName}</span>}
          </div>
        </div>
        <div className="text-gray-400 ml-4 flex-shrink-0">
          {expanded ? '▼' : '▶'}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-200 px-6 py-4 space-y-6">
          {/* Questions and Responses */}
          {snapshot.responses_json && snapshot.responses_json.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 text-sm">Questions</h4>
              {snapshot.responses_json.map((response) => (
                <div key={response.question_id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                        [{response.question_type}]
                      </p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {response.question_text}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0 text-right">
                      <p className="text-sm font-semibold text-gray-900">{response.score}/5</p>
                      <p className="text-xs text-gray-600">
                        {['', 'Poor', 'Below Avg', 'Average', 'Good', 'Excellent'][response.score]}
                      </p>
                    </div>
                  </div>

                  {/* Question Type-Specific Content */}
                  {response.question_type === 'text' && (
                    <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 whitespace-pre-wrap">
                      {response.notes || '—'}
                    </div>
                  )}

                  {response.question_type === 'code' && (
                    <CodeHistory
                      submission={snapshot.code_submissions_json?.find(
                        (c) => c.question_id === response.question_id,
                      )!}
                    />
                  )}

                  {response.question_type === 'system_design' && (
                    <DrawingHistory
                      drawing={snapshot.drawings_json?.find(
                        (d) => d.question_id === response.question_id,
                      )!}
                    />
                  )}

                  {/* Notes */}
                  {response.notes && response.question_type !== 'text' && (
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">Notes</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{response.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Overall Notes */}
          {snapshot.interviewer_notes && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <p className="text-xs font-medium text-gray-700 uppercase font-semibold tracking-wide">
                Interviewer Notes
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {snapshot.interviewer_notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
