import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { getQuestions } from '@/lib/sheets/queries'
import type { QuestionFilters } from '@/types'

export async function GET(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  let filters: QuestionFilters = {
    role_id: searchParams.get('role_id') ?? undefined,
    screening_type_id: searchParams.get('screening_type_id') ?? undefined,
    difficulty: (searchParams.get('difficulty') as QuestionFilters['difficulty']) ?? undefined,
    type: (searchParams.get('type') as QuestionFilters['type']) ?? undefined,
  }

  // Interviewee: override with token claims — no manual filter override allowed
  if (user.role === 'interviewee') {
    filters = {
      role_id: user.role_id,
      screening_type_id: user.screening_type_id,
      difficulty: user.difficulty,
      type: filters.type,
    }
  }

  let questions = await getQuestions(filters)

  // Strip sensitive fields from interviewee response
  if (user.role === 'interviewee') {
    questions = questions.map(({ rubric: _r, expected_answer: _e, ...q }) => ({
      ...q,
      rubric: null,
      expected_answer: null,
    }))
  }

  return NextResponse.json(questions)
}
