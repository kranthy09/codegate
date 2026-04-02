/**
 * Reporting helper: Build denormalized CandidatePipelineSnapshot
 * for external API consumption and audit trail.
 */

import type {
  CandidatePipelineSnapshot,
  InterviewAnswer,
  TextAnswer,
  CodeAnswer,
  SystemDesignAnswer,
  Screening,
  Response,
  CodeSubmission,
  Drawing,
  Question,
  Recommendation,
} from '@/types'

function generateId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

/**
 * Build a denormalized snapshot of a completed screening.
 * Includes all question answers (text/code/system_design) with scores and notes,
 * grouped by type for external API queries.
 *
 * @param screening The screening record (completed)
 * @param responses All question responses with scores
 * @param questions Full question definitions (for text)
 * @param submissions Latest code submissions per question
 * @param drawings Latest drawings per question
 * @returns CandidatePipelineSnapshot ready for sheet sync
 */
export function buildCandidatePipelineSnapshot(
  screening: Screening,
  responses: Response[],
  questions: Question[],
  submissions: Map<string, CodeSubmission>,
  drawings: Map<string, Drawing>,
  overallScore: number | null,
  recommendation: Recommendation | null,
  notes: string | null,
): CandidatePipelineSnapshot {
  const responseAnswers: InterviewAnswer[] = []

  // Build answer objects per response, merged with submission/drawing data
  for (const response of responses) {
    const question = questions.find((q) => q.id === response.question_id)
    if (!question) continue

    let answer: InterviewAnswer | null = null

    switch (response.question_type) {
      case 'text': {
        const textAnswer: TextAnswer = {
          question_id: response.question_id,
          question_type: 'text',
          question_text: question.text,
          score: response.score,
          notes: response.notes,
          submitted_at: response.submitted_at,
        }
        answer = textAnswer
        break
      }

      case 'code': {
        const submission = submissions.get(response.question_id)
        if (submission) {
          const codeAnswer: CodeAnswer = {
            question_id: response.question_id,
            question_type: 'code',
            question_text: question.text,
            language: submission.language,
            code: submission.code,
            stdout: submission.stdout,
            stderr: submission.stderr,
            exit_code: submission.exit_code,
            score: response.score,
            notes: response.notes,
            submitted_at: response.submitted_at,
          }
          answer = codeAnswer
        }
        break
      }

      case 'system_design': {
        const drawing = drawings.get(response.question_id)
        if (drawing) {
          const designAnswer: SystemDesignAnswer = {
            question_id: response.question_id,
            question_type: 'system_design',
            question_text: question.text,
            excalidraw_json: drawing.excalidraw_json,
            score: response.score,
            notes: response.notes,
            submitted_at: response.submitted_at,
          }
          answer = designAnswer
        }
        break
      }
    }

    if (answer) {
      responseAnswers.push(answer)
    }
  }

  // Group answers by type for external API
  const codeAnswers = responseAnswers.filter(
    (a) => a.question_type === 'code',
  ) as CodeAnswer[]
  const drawingAnswers = responseAnswers.filter(
    (a) => a.question_type === 'system_design',
  ) as SystemDesignAnswer[]

  return {
    id: generateId(),
    candidate_id: screening.candidate_id,
    screening_id: screening.id,
    role_id: screening.role_id,
    screening_type_id: screening.screening_type_id,
    status: 'completed',
    overall_score: overallScore,
    recommendation,
    responses_json: responseAnswers,
    code_submissions_json: codeAnswers,
    drawings_json: drawingAnswers,
    interviewer_notes: notes,
    created_at: now(),
    completed_at: now(),
  }
}
