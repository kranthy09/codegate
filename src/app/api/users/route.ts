import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import { getUsers } from '@/lib/sheets/queries'
import { createUser } from '@/lib/sheets/mutations'
import type { CreateUserPayload } from '@/types'

export async function GET() {
  const user = await getServerUser()
  requireRole(user, ['admin'])
  const users = await getUsers()
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  requireRole(user, ['admin'])

  const body = (await req.json()) as CreateUserPayload
  if (!body.name || !body.email || !body.role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const created = await createUser(body)
  return NextResponse.json(created, { status: 201 })
}
