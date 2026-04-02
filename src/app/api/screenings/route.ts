import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import { getScreenings } from '@/lib/sheets/queries'
import { createScreening } from '@/lib/sheets/mutations'
import type { CreateScreeningPayload } from '@/types'

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const screenings = await getScreenings(user)
  return NextResponse.json(screenings)
}

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager', 'interviewer'])

  const body = (await req.json()) as CreateScreeningPayload
  if (!body.candidate_id || !body.role_id || !body.screening_type_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const screening = await createScreening(body, user.id)
  return NextResponse.json(screening, { status: 201 })
}
