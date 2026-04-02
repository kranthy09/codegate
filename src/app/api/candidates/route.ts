import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import { getCandidates } from '@/lib/sheets/queries'
import { createCandidate } from '@/lib/sheets/mutations'
import type { CreateCandidatePayload } from '@/types'

export async function GET() {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager'])
  const candidates = await getCandidates()
  return NextResponse.json(candidates)
}

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager'])

  const body = (await req.json()) as CreateCandidatePayload
  if (!body.name || !body.email || !body.applied_role_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const candidate = await createCandidate(body)
  return NextResponse.json(candidate, { status: 201 })
}
