import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import { updateUserRole } from '@/lib/sheets/mutations'
import type { User } from '@/types'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getServerUser()
  requireRole(user, ['admin'])

  const { id } = await params
  const { role } = (await req.json()) as { role: User['role'] }

  if (!role) return NextResponse.json({ error: 'role required' }, { status: 400 })

  await updateUserRole(id, role)
  return NextResponse.json({ success: true })
}
