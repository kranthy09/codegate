import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import { getCodeSubmissions } from '@/lib/sheets/queries'
import { appendCodeSubmission } from '@/lib/sheets/mutations'
import type { CodeSubmissionPayload } from '@/types'

export async function GET(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const screening_id = searchParams.get('screening_id')
  const question_id = searchParams.get('question_id') ?? undefined

  if (!screening_id) return NextResponse.json({ error: 'screening_id required' }, { status: 400 })

  const submissions = await getCodeSubmissions(screening_id, question_id)

  // Interviewee can only see their own
  if (user.role === 'interviewee') {
    return NextResponse.json(submissions.filter((s) => s.candidate_id === user.id))
  }

  return NextResponse.json(submissions)
}

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  requireRole(user, ['interviewee'])

  const body = (await req.json()) as CodeSubmissionPayload
  if (!body.screening_id || !body.question_id || !body.code) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  await appendCodeSubmission(body, user.id)
  return NextResponse.json({ success: true }, { status: 201 })
}
