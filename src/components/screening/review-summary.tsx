'use client'

import type { Question, Response, CodeSubmission, Drawing } from '@/types'
import { CodeReviewCard } from './code-review-card'
import { DesignReviewCard } from './design-review-card'

interface Props {
  questions: Question[]
  responses: Response[]
  submissions: Map<string, CodeSubmission>
  drawings: Map<string, Drawing>
  candidateName: string
  roleName: string
  screeningTypeName: string
}

/**
 * Display all questions with their type-appropriate review content.
 * Each question shows the candidate's submission/answer along with the score and notes.
 */
export function ReviewSummary({
  questions,
  responses,
  submissions,
  drawings,
  candidateName,
  roleName,
  screeningTypeName,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-lg font-semibold text-gray-900">Review</h2>
        <p className="text-sm text-gray-600 mt-1">
          {candidateName} · {roleName} · {screeningTypeName}
        </p>
      </div>

      {questions.map((question) => {
        const response = responses.find((r) => r.question_id === question.id)
        if (!response) return null

        const questionTypeLabel = {
          text: '[TEXT]',
          code: '[CODE]',
          system_design: '[DESIGN]',
        }[question.type]

        return (
          <div key={question.id} className="border border-gray-200 rounded-lg p-6">
            <h3 className="font-medium text-gray-900">
              <span className="text-xs font-semibold text-gray-500 uppercase">
                {questionTypeLabel}
              </span>{' '}
              {question.text}
            </h3>

            <div className="mt-4">
              {question.type === 'text' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Score</span>
                    <span className="inline-flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {response.score}/5
                      </span>
                      <span className="text-xs text-gray-500">
                        {
                          ['', 'Poor', 'Below Avg', 'Average', 'Good', 'Excellent'][
                            response.score
                          ]
                        }
                      </span>
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Notes</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {response.notes || '—'}
                    </p>
                  </div>
                </div>
              )}

              {question.type === 'code' && submissions.has(question.id) && (
                <CodeReviewCard
                  submission={submissions.get(question.id)!}
                  score={response.score}
                  notes={response.notes}
                />
              )}

              {question.type === 'system_design' && drawings.has(question.id) && (
                <DesignReviewCard
                  drawing={drawings.get(question.id)!}
                  score={response.score}
                  notes={response.notes}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
