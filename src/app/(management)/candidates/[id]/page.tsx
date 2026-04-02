import Link from 'next/link'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import {
  getCandidateById,
  getScreenings,
  getCandidatePipelineSnapshot,
  getRoles,
  getScreeningTypes,
  getUsers,
} from '@/lib/sheets/queries'
import { updateCandidateStatus } from '@/lib/sheets/mutations'
import { PerformanceSummary } from '@/components/dashboard/performance-summary'
import { PipelineStages } from '@/components/dashboard/pipeline-stages'
import { ScreeningDetail } from '@/components/dashboard/screening-detail'
import type { CandidatePerformance, Recommendation } from '@/types'

/**
 * Candidate dashboard page.
 * Shows full pipeline with stages, scores, recommendations, and interview details.
 */
export default async function CandidateDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager', 'interviewer'])

  const { id } = await params

  // Fetch all needed data in parallel
  const [candidate, allScreenings, snapshots, roles, screeningTypes, users] = await Promise.all([
    getCandidateById(id),
    getScreenings(user),
    getCandidatePipelineSnapshot(id),
    getRoles(),
    getScreeningTypes(),
    getUsers(),
  ])

  if (!candidate) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-center py-20">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Candidate Not Found</h1>
          <p className="text-gray-600">
            <Link href="/management/candidates" className="text-blue-600 hover:text-blue-800">
              ← Back to candidates
            </Link>
          </p>
        </div>
      </main>
    )
  }

  // Filter screenings to this candidate
  const candidateScreenings = allScreenings.filter((s) => s.candidate_id === id)
  const completed = candidateScreenings.filter((s) => s.status === 'completed')

  // Compute performance
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
    total_stages: candidateScreenings.length,
    recommendation_counts,
  }

  // Build lookup maps
  const roleMap = new Map(roles.map((r) => [r.id, r.name]))
  const screeningTypeMap = new Map(screeningTypes.map((st) => [st.id, st.name]))
  const userMap = new Map(users.map((u) => [u.id, u.name]))

  const appliedRoleName = roleMap.get(candidate.applied_role_id) || candidate.applied_role_id

  // Sort snapshots by screening type order
  const sortedSnapshots = snapshots.sort((a, b) => {
    const aOrder =
      screeningTypes.find((st) => st.id === a.screening_type_id)?.stage_order ?? 999
    const bOrder =
      screeningTypes.find((st) => st.id === b.screening_type_id)?.stage_order ?? 999
    return aOrder - bOrder
  })

  const statusColors: Record<typeof candidate.status, string> = {
    active: 'bg-blue-100 text-blue-800',
    hired: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    hold: 'bg-amber-100 text-amber-800',
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">{candidate.name}</h1>
            <p className="text-gray-600 mt-1">
              {appliedRoleName} • {candidate.email}
            </p>
          </div>
          <Link
            href="/management/candidates"
            className="text-gray-600 hover:text-gray-900 text-sm"
          >
            ← Back
          </Link>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[candidate.status]}`}>
            {candidate.status.charAt(0).toUpperCase() + candidate.status.slice(1)}
          </span>
          <span className="text-xs text-gray-500">
            Applied {new Date(candidate.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Performance Summary */}
      <div className="mb-8">
        <PerformanceSummary performance={performance} />
      </div>

      {/* Pipeline Stages */}
      <div className="mb-8">
        <PipelineStages screenings={candidateScreenings} screeningTypes={screeningTypes} />
      </div>

      {/* Screening Details */}
      {sortedSnapshots.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Screening Details</h2>
          {sortedSnapshots.map((snapshot) => (
            <ScreeningDetail
              key={snapshot.screening_id}
              snapshot={snapshot}
              screeningTypeName={screeningTypeMap.get(snapshot.screening_type_id) || snapshot.screening_type_id}
              interviewerName={
                userMap.get(
                  candidateScreenings.find((s) => s.id === snapshot.screening_id)?.interviewer_id || '',
                ) || 'Unknown'
              }
            />
          ))}
        </div>
      )}
    </main>
  )
}
