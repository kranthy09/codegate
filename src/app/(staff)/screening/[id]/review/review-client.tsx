'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useScreening } from '@/hooks/use-screening'
import { ReviewSummary } from '@/components/screening/review-summary'
import { FinalForm } from '@/components/screening/final-form'
import type { Screening, Candidate, Question, Response, CodeSubmission, Drawing } from '@/types'

interface Props {
  screening: Screening
  candidate: Candidate
  questions: Question[]
  responses: Response[]
  submissions: Map<string, CodeSubmission>
  drawings: Map<string, Drawing>
  roleName: string
  screeningTypeName: string
}

/**
 * Client-side review flow for interviewer to finalize screening assessment.
 * Submits responses, builds pipeline snapshot, and marks screening as complete.
 */
export function ReviewClient({
  screening,
  candidate,
  questions,
  responses,
  submissions,
  drawings,
  roleName,
  screeningTypeName,
}: Props) {
  const router = useRouter()
  const store = useScreening()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize store on mount
  useEffect(() => {
    store.init(screening.id, candidate.name, questions)
  }, [screening.id, candidate.name, questions, store])

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      // 1. Submit question responses
      const res1 = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screening_id: screening.id,
          responses: questions.map((q) => ({
            question_id: q.id,
            question_type: q.type,
            score: store.scores[q.id] ?? 0,
            notes: store.notes[q.id] ?? '',
          })),
        }),
      })

      if (!res1.ok) {
        throw new Error('Failed to submit responses')
      }

      // 2. Build and sync pipeline snapshot
      const res2 = await fetch('/api/screenings/pipeline-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screening_id: screening.id,
          overall_score: store.overallScore,
          recommendation: store.recommendation,
          notes: store.overallNotes,
        }),
      })

      if (!res2.ok) {
        throw new Error('Failed to sync pipeline data')
      }

      // 3. Mark screening as completed
      const res3 = await fetch(`/api/screenings/${screening.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          overall_score: store.overallScore,
          recommendation: store.recommendation,
          notes: store.overallNotes,
          completed_at: new Date().toISOString(),
        }),
      })

      if (!res3.ok) {
        throw new Error('Failed to complete screening')
      }

      // Success — redirect to candidate dashboard
      router.push(`/candidates/${candidate.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Error Alert */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <p className="text-sm text-red-700 font-medium">{error}</p>
          <p className="text-xs text-red-600 mt-1">
            Please review your entries and try again.
          </p>
        </div>
      )}

      {/* Review Summary */}
      <ReviewSummary
        questions={questions}
        responses={responses}
        submissions={submissions}
        drawings={drawings}
        candidateName={candidate.name}
        roleName={roleName}
        screeningTypeName={screeningTypeName}
      />

      {/* Final Form */}
      <FinalForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  )
}
