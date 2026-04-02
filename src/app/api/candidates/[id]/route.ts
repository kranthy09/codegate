import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import { getCandidateById, getScreenings } from '@/lib/sheets/queries'
import { updateCandidateStatus } from '@/lib/sheets/mutations'
import type { CandidatePerformance, Recommendation, Candidate } from '@/types'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager', 'interviewer'])

  const { id } = await params
  const [candidate, allScreenings] = await Promise.all([
    getCandidateById(id),
    getScreenings(user),
  ])

  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const screenings = allScreenings.filter((s) => s.candidate_id === id)
  const completed = screenings.filter((s) => s.status === 'completed')

  const average_score = completed.length
    ? Number(
        (completed.reduce((sum, s) => sum + (s.overall_score ?? 0), 0) / completed.length).toFixed(1)
      )
    : null

  const recommendation_counts = completed.reduce((acc, s) => {
    if (s.recommendation) acc[s.recommendation] = (acc[s.recommendation] ?? 0) + 1
    return acc
  }, {} as Partial<Record<Recommendation, number>>)

  const performance: CandidatePerformance = {
    average_score,
    completed_stages: completed.length,
    total_stages: screenings.length,
    recommendation_counts,
  }

  return NextResponse.json({ candidate, screenings, performance })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager'])

  const { id } = await params
  const { status } = (await req.json()) as { status: Candidate['status'] }
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  await updateCandidateStatus(id, status)
  return NextResponse.json({ success: true })
}
