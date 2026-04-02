import { NextResponse, type NextRequest } from 'next/server'
import { validateExternalApiKey } from '@/lib/auth/external-api'
import { getCandidateById, getCandidatePipelineSnapshot } from '@/lib/sheets/queries'

/**
 * External API — Get full candidate pipeline (all screenings with embedded answers).
 * Used by ATS/HR tools to sync candidate assessment data.
 *
 * Requires API key with 'candidates' scope.
 *
 * GET /api/external/candidates/[id]/pipeline
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await validateExternalApiKey(req.headers.get('authorization'), 'candidates')
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id } = await params

  // Fetch candidate and pipeline snapshots in parallel
  const [candidate, pipeline] = await Promise.all([
    getCandidateById(id),
    getCandidatePipelineSnapshot(id),
  ])

  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  return NextResponse.json({ candidate, pipeline_snapshots: pipeline })
}
