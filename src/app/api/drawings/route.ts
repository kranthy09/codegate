import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import { getLatestDrawing } from '@/lib/sheets/queries'
import { appendDrawing } from '@/lib/sheets/mutations'
import type { DrawingPayload } from '@/types'

export async function GET(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const screening_id = searchParams.get('screening_id')
  const question_id = searchParams.get('question_id')

  if (!screening_id || !question_id) {
    return NextResponse.json({ error: 'screening_id and question_id required' }, { status: 400 })
  }

  const drawing = await getLatestDrawing(screening_id, question_id)
  if (!drawing) return NextResponse.json(null)

  // Interviewee can only see their own
  if (user.role === 'interviewee' && drawing.candidate_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(drawing)
}

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  requireRole(user, ['interviewee'])

  const body = (await req.json()) as DrawingPayload
  if (!body.screening_id || !body.question_id || !body.excalidraw_json) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  await appendDrawing(body, user.id)
  return NextResponse.json({ success: true }, { status: 201 })
}
