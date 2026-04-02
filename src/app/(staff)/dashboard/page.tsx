import Link from 'next/link'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import { getScreenings, getCandidates, getScreeningTypes } from '@/lib/sheets/queries'

/**
 * Staff dashboard page.
 * Shows active screenings for interviewers, or all screenings for admin/manager.
 */
export default async function DashboardPage() {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager', 'interviewer'])

  // Fetch screenings (RBAC-filtered by getScreenings), candidates, and screening types
  const [screenings, candidates, screeningTypes] = await Promise.all([
    getScreenings(user),
    getCandidates(),
    getScreeningTypes(),
  ])

  // Build lookup maps
  const candidateMap = new Map(candidates.map((c) => [c.id, c]))
  const screeningTypeMap = new Map(screeningTypes.map((st) => [st.id, st.name]))

  // Sort screenings by scheduled_at (most recent first)
  const sortedScreenings = [...screenings].sort(
    (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
  )

  const statusColors: Record<string, string> = {
    in_progress: 'bg-amber-100 text-amber-800',
    scheduled: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
  }

  const statusLabel: Record<string, string> = {
    in_progress: '● In Progress',
    scheduled: '○ Scheduled',
    completed: '✓ Completed',
    cancelled: '✗ Cancelled',
  }

  const titlePrefix = user!.role === 'interviewer' ? 'My ' : ''

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{titlePrefix}Screenings</h1>
        <p className="text-sm text-gray-600 mt-1">
          {user!.role === 'interviewer'
            ? 'Your assigned screening sessions'
            : 'All screening sessions'}
        </p>
      </div>

      {/* Screenings Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Candidate</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Stage</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Scheduled</th>
              {user!.role !== 'interviewer' && (
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Interviewer</th>
              )}
              <th className="px-6 py-3 text-left font-semibold text-gray-900"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedScreenings.length > 0 ? (
              sortedScreenings.map((screening) => {
                const candidate = candidateMap.get(screening.candidate_id)
                const stageName = screeningTypeMap.get(screening.screening_type_id) || screening.screening_type_id

                return (
                  <tr key={screening.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {candidate?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{stageName}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          statusColors[screening.status]
                        }`}
                      >
                        {statusLabel[screening.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">
                      {new Date(screening.scheduled_at).toLocaleString()}
                    </td>
                    {user!.role !== 'interviewer' && (
                      <td className="px-6 py-4 text-gray-600 text-xs">{screening.interviewer_id}</td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/staff/screening/${screening.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td
                  colSpan={user!.role === 'interviewer' ? 5 : 6}
                  className="px-6 py-8 text-center text-gray-500"
                >
                  No screenings found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 text-xs text-gray-600">
        {user!.role === 'interviewer'
          ? `${sortedScreenings.length} screening${sortedScreenings.length !== 1 ? 's' : ''} assigned to you`
          : `${sortedScreenings.length} total screening${sortedScreenings.length !== 1 ? 's' : ''}`}
      </div>
    </main>
  )
}
