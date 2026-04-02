import { NextResponse, type NextRequest } from 'next/server'
import { validateExternalApiKey } from '@/lib/auth/external-api'
import { getCandidates, getCandidatePipelineSnapshot } from '@/lib/sheets/queries'

/**
 * External API — list all candidates with their pipeline snapshots.
 * Requires API key with 'candidates' scope.
 *
 * GET /api/external/candidates
 */
export async function GET(req: NextRequest) {
  try {
    await validateExternalApiKey(req.headers.get('authorization'), 'candidates')
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  const candidates = await getCandidates()

  // Attach pipeline snapshots for each candidate in parallel
  const results = await Promise.all(
    candidates.map(async (c) => {
      const pipeline = await getCandidatePipelineSnapshot(c.id)
      return { ...c, pipeline }
    }),
  )

  return NextResponse.json(results)
}
