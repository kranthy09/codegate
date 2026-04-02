import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import { listApiKeys } from '@/lib/sheets/queries'
import { createApiKey } from '@/lib/sheets/mutations'
import type { CreateApiKeyPayload } from '@/types'

export async function GET() {
  const user = await getServerUser()
  requireRole(user, ['admin'])
  const keys = await listApiKeys()
  // Never expose hashed_key in list response
  return NextResponse.json(keys.map(({ hashed_key: _, ...rest }) => rest))
}

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  requireRole(user, ['admin'])

  const body = (await req.json()) as Partial<CreateApiKeyPayload>
  if (!body.name || !Array.isArray(body.scope) || body.scope.length === 0) {
    return NextResponse.json({ error: 'name and scope[] required' }, { status: 400 })
  }

  const payload: CreateApiKeyPayload = {
    name: body.name,
    scope: body.scope,
    created_by: user!.id,
  }

  const { key, plaintext } = await createApiKey(payload)
  // Return plaintext once — caller must store it; we never store it
  return NextResponse.json(
    { ...key, hashed_key: undefined, plaintext },
    { status: 201 },
  )
}
