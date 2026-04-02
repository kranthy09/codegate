import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import {
  getScreeningById,
  getResponsesByScreeningId,
  getQuestions,
  getCodeSubmissions,
  getLatestDrawing,
} from '@/lib/sheets/queries'
import { syncCandidatePipelineSnapshot } from '@/lib/sheets/mutations'
import { buildCandidatePipelineSnapshot } from '@/lib/sheets/reporting'
import type { Recommendation } from '@/types'

/**
 * POST /api/screenings/pipeline-snapshot
 *
 * Build and sync a denormalized pipeline snapshot for external API consumption.
 * Called during the review submit phase after all responses are saved.
 *
 * Request body:
 * {
 *   screening_id: string
 *   overall_score: number | null
 *   recommendation: Recommendation | null
 *   notes: string
 * }
 *
 * The snapshot merges responses, code submissions, drawings, and question metadata
 * into a single denormalized JSON record for fast ATS/external reporting API access.
 */
export async function POST(req: NextRequest) {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager', 'interviewer'])

  const body = await req.json()
  const {
    screening_id,
    overall_score,
    recommendation,
    notes,
  } = body as {
    screening_id: string
    overall_score: number | null
    recommendation: Recommendation | null
    notes: string
  }

  if (!screening_id) {
    return NextResponse.json({ error: 'screening_id required' }, { status: 400 })
  }

  // Fetch screening and verify RBAC
  const screening = await getScreeningById(screening_id)
  if (!screening) {
    return NextResponse.json({ error: 'Screening not found' }, { status: 404 })
  }

  if (user.role === 'interviewer' && screening.interviewer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch all related data
  const [responses, questions, submissions] = await Promise.all([
    getResponsesByScreeningId(screening_id),
    getQuestions({
      role_id: screening.role_id,
      screening_type_id: screening.screening_type_id,
    }),
    getCodeSubmissions(screening_id),
  ])

  // Build drawings map (one latest per question)
  const drawingsMap = new Map()
  for (const question of questions) {
    if (question.type === 'system_design') {
      const drawing = await getLatestDrawing(screening_id, question.id)
      if (drawing) {
        drawingsMap.set(question.id, drawing)
      }
    }
  }

  // Build submissions map (latest per question)
  const submissionsMap = new Map()
  for (const submission of submissions) {
    submissionsMap.set(submission.question_id, submission)
  }

  // Build snapshot
  const snapshot = buildCandidatePipelineSnapshot(
    screening,
    responses,
    questions,
    submissionsMap,
    drawingsMap,
    overall_score,
    recommendation,
    notes,
  )

  // Sync to sheets (upsert)
  await syncCandidatePipelineSnapshot(snapshot)

  return NextResponse.json({ success: true })
}
