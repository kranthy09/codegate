import { NextResponse, type NextRequest } from 'next/server'
import { validateExternalApiKey } from '@/lib/auth/external-api'
import {
  getScreeningById,
  getCandidateById,
  getResponsesByScreeningId,
  getCodeSubmissions,
  getLatestDrawing,
  getQuestions,
} from '@/lib/sheets/queries'

/**
 * External API — get full screening with all answers.
 * Requires API key with 'screenings' scope.
 *
 * GET /api/external/screenings/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await validateExternalApiKey(req.headers.get('authorization'), 'screenings')
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id } = await params
  const screening = await getScreeningById(id)
  if (!screening) {
    return NextResponse.json({ error: 'Screening not found' }, { status: 404 })
  }

  const [candidate, responses, codeSubmissions, questions] = await Promise.all([
    getCandidateById(screening.candidate_id),
    getResponsesByScreeningId(id),
    getCodeSubmissions(id),
    getQuestions({ role_id: screening.role_id, screening_type_id: screening.screening_type_id }),
  ])

  // Fetch drawings for each system_design question
  const drawingQuestions = questions.filter((q) => q.type === 'system_design')
  const drawings = (
    await Promise.all(drawingQuestions.map((q) => getLatestDrawing(id, q.id)))
  ).filter(Boolean)

  return NextResponse.json({
    screening,
    candidate,
    responses,
    code_submissions: codeSubmissions,
    drawings,
  })
}
