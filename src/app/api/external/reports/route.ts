import { NextResponse, type NextRequest } from 'next/server'
import { validateExternalApiKey } from '@/lib/auth/external-api'
import { getCandidates, getCandidatePipelineSnapshot, getScreeningTypes } from '@/lib/sheets/queries'
import type { CandidatePipelineSnapshot, Recommendation } from '@/types'

function aggregatePerformance(snapshots: CandidatePipelineSnapshot[]) {
  const completed = snapshots.filter((s) => s.status === 'completed')
  const scores = completed.map((s) => s.overall_score).filter((s): s is number => s !== null)
  const average_score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null

  const recommendation_counts: Partial<Record<Recommendation, number>> = {}
  for (const s of completed) {
    if (s.recommendation) {
      recommendation_counts[s.recommendation] = (recommendation_counts[s.recommendation] ?? 0) + 1
    }
  }

  return {
    completed_stages: completed.length,
    total_stages: snapshots.length,
    average_score: average_score !== null ? Math.round(average_score * 10) / 10 : null,
    recommendation_counts,
  }
}

/**
 * External API — aggregated candidate performance reports.
 * Requires API key with 'reports' scope.
 *
 * GET /api/external/reports
 * Optional query params:
 *   ?status=active|hired|rejected|hold  — filter candidates by status
 */
export async function GET(req: NextRequest) {
  try {
    await validateExternalApiKey(req.headers.get('authorization'), 'reports')
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status')

  const [candidates, screeningTypes] = await Promise.all([
    getCandidates(),
    getScreeningTypes(),
  ])

  const filtered = statusFilter
    ? candidates.filter((c) => c.status === statusFilter)
    : candidates

  const reports = await Promise.all(
    filtered.map(async (candidate) => {
      const snapshots = await getCandidatePipelineSnapshot(candidate.id)
      const performance = aggregatePerformance(snapshots)

      const stages = snapshots.map((s) => {
        const stageType = screeningTypes.find((t) => t.id === s.screening_type_id)
        return {
          screening_id: s.screening_id,
          screening_type: stageType?.name ?? s.screening_type_id,
          stage_order: stageType?.stage_order ?? 0,
          status: s.status,
          overall_score: s.overall_score,
          recommendation: s.recommendation,
          completed_at: s.completed_at,
        }
      }).sort((a, b) => a.stage_order - b.stage_order)

      return {
        candidate,
        performance,
        stages,
      }
    }),
  )

  return NextResponse.json(reports)
}
