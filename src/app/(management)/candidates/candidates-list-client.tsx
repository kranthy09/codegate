'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import type { Candidate } from '@/types'

interface Props {
  candidates: Candidate[]
  roleMap: Map<string, string>
}

const statusColors: Record<Candidate['status'], string> = {
  active: 'bg-blue-100 text-blue-800',
  hired: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  hold: 'bg-amber-100 text-amber-800',
}

/**
 * Client component for candidate list with search.
 */
export function CandidateListClient({ candidates, roleMap }: Props) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter candidates by name or email
  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return candidates.filter(
      (c) => c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query),
    )
  }, [candidates, searchQuery])

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search by name or email…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 placeholder:text-gray-400"
      />

      {/* Candidates Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Name</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Email</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Role</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Created</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.length > 0 ? (
              filtered.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{candidate.name}</td>
                  <td className="px-6 py-4 text-gray-600">{candidate.email}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {roleMap.get(candidate.applied_role_id) || candidate.applied_role_id}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        statusColors[candidate.status]
                      }`}
                    >
                      {candidate.status.charAt(0).toUpperCase() + candidate.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-xs">
                    {new Date(candidate.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/management/candidates/${candidate.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No candidates found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="text-xs text-gray-600">
        Showing {filtered.length} of {candidates.length} candidates
      </div>
    </div>
  )
}
