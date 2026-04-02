import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import { getCandidatePipelineSnapshot } from '@/lib/sheets/queries'
import type { CodeAnswer, SystemDesignAnswer } from '@/types'

/**
 * Internal API — Get candidate activity timeline (code submissions + drawings by screening).
 * Used by staff to review candidate's work history across all screenings.
 *
 * GET /api/candidates/[id]/activity
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager', 'interviewer'])

  const { id } = await params

  // Fetch all pipeline snapshots for the candidate
  // Each snapshot contains embedded code_submissions_json and drawings_json
  const snapshots = await getCandidatePipelineSnapshot(id)

  // Build grouped structure: by_screening[screening_id] => { code_submissions, drawings }
  const by_screening: Record<
    string,
    {
      code_submissions: CodeAnswer[]
      drawings: SystemDesignAnswer[]
    }
  > = {}

  for (const snapshot of snapshots) {
    by_screening[snapshot.screening_id] = {
      code_submissions: snapshot.code_submissions_json || [],
      drawings: snapshot.drawings_json || [],
    }
  }

  return NextResponse.json({ by_screening })
}
