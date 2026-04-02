import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import { getResponsesByScreeningId, getScreeningById } from '@/lib/sheets/queries'
import { appendResponses } from '@/lib/sheets/mutations'
import type { SubmitResponsesPayload } from '@/types'

/**
 * GET /api/responses?screening_id=XXX — Retrieve responses for a screening
 * Requires role: admin, manager, or interviewer.
 */
export async function GET(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const screening_id = req.nextUrl.searchParams.get('screening_id')
  if (!screening_id) return NextResponse.json({ error: 'screening_id required' }, { status: 400 })

  const screening = await getScreeningById(screening_id)
  if (!screening) return NextResponse.json({ error: 'Screening not found' }, { status: 404 })

  // Interviewer can only view responses for their screenings
  if (user.role === 'interviewer' && screening.interviewer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const responses = await getResponsesByScreeningId(screening_id)
  return NextResponse.json(responses)
}

/**
 * POST /api/responses — Bulk submit question responses (scores + notes)
 * Called by interviewer during review → submit phase.
 * Requires role: admin, manager, or interviewer.
 */
export async function POST(req: NextRequest) {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager', 'interviewer'])

  const body = (await req.json()) as SubmitResponsesPayload
  if (!body.screening_id || !Array.isArray(body.responses) || body.responses.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify screening and RBAC
  const screening = await getScreeningById(body.screening_id)
  if (!screening) {
    return NextResponse.json({ error: 'Screening not found' }, { status: 404 })
  }

  if (user.role === 'interviewer' && screening.interviewer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Validate response scores
  for (const r of body.responses) {
    if (r.score < 1 || r.score > 5) {
      return NextResponse.json(
        { error: 'Score must be between 1 and 5' },
        { status: 400 },
      )
    }
  }

  await appendResponses(body)
  return NextResponse.json({ success: true }, { status: 201 })
}
