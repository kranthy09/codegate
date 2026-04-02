import { createHash } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getApiKeyByHash } from '@/lib/sheets/queries'

/**
 * External API — Validate an external API key.
 * Used by ATS/HR tools to test their key before making real requests.
 *
 * POST /api/external/auth
 * Body: { "key": "pk_live_..." }
 *
 * Response (200): { "valid": true, "scope": [...], "created_at": "...", "active": true }
 * Response (401): { "error": "Invalid or expired key" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { key?: string }
    if (!body.key) {
      return NextResponse.json({ error: 'Missing key in request body' }, { status: 400 })
    }

    // Hash the plaintext key and look it up
    const hashed = createHash('sha256').update(body.key).digest('hex')
    const apiKey = await getApiKeyByHash(hashed)

    if (!apiKey) {
      return NextResponse.json({ error: 'Invalid or expired key' }, { status: 401 })
    }

    // Return key metadata (never expose hashed_key)
    return NextResponse.json({
      valid: true,
      scope: apiKey.scope,
      created_at: apiKey.created_at,
      active: apiKey.active,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
