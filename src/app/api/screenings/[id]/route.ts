import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import { getScreeningById, getQuestions, getCandidateById } from '@/lib/sheets/queries'
import { updateScreening } from '@/lib/sheets/mutations'
import type { UpdateScreeningPayload } from '@/types'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const screening = await getScreeningById(id)
  if (!screening) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Interviewee can only access their own screening
  if (user.role === 'interviewee' && screening.candidate_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Interviewer can only access their own assigned screenings
  if (user.role === 'interviewer' && screening.interviewer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [questions, candidate] = await Promise.all([
    getQuestions({ role_id: screening.role_id, screening_type_id: screening.screening_type_id }),
    getCandidateById(screening.candidate_id),
  ])

  // Strip sensitive fields from interviewee view
  const safeQuestions = user.role === 'interviewee'
    ? questions.map(({ rubric: _r, expected_answer: _e, ...q }) => ({ ...q, rubric: null, expected_answer: null }))
    : questions

  return NextResponse.json({ screening, questions: safeQuestions, candidate })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager', 'interviewer'])

  const { id } = await params
  const screening = await getScreeningById(id)
  if (!screening) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Interviewer can only update their own screenings
  if (user.role === 'interviewer' && screening.interviewer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as UpdateScreeningPayload
  await updateScreening(id, body)
  return NextResponse.json({ success: true })
}
