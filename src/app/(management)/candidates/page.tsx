import Link from 'next/link'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import { getCandidates, getRoles } from '@/lib/sheets/queries'
import { CandidateListClient } from './candidates-list-client'

/**
 * Management candidates list page.
 * Displays all candidates with their status, role, and creation date.
 * Admin and manager only.
 */
export default async function CandidatesPage() {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager'])

  // Fetch candidates and roles in parallel
  const [candidates, roles] = await Promise.all([getCandidates(), getRoles()])

  // Build role map for quick lookup
  const roleMap = new Map(roles.map((r) => [r.id, r.name]))

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Candidates</h1>
        <p className="text-sm text-gray-600 mt-1">Manage and review candidate applications</p>
      </div>

      <CandidateListClient candidates={candidates} roleMap={roleMap} />
    </main>
  )
}
