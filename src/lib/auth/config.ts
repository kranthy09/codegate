import { headers } from 'next/headers'
import type { SessionUser } from '@/types'

// Re-export session primitives so middleware and route handlers can import from one place
export { createSession, verifySession, SESSION_COOKIE, SESSION_MAX_AGE } from './session'

/**
 * Read the current user from request headers set by middleware.
 * Use this in Server Components and Route Handlers.
 */
export async function getServerUser(): Promise<SessionUser | null> {
  const h = await headers()
  const id = h.get('x-user-id')
  const role = h.get('x-user-role') as SessionUser['role'] | null

  if (!id || !role) return null

  return {
    id,
    name: h.get('x-user-name') ?? '',
    email: h.get('x-user-email') ?? '',
    role,
    role_id: h.get('x-role-id') ?? undefined,
    screening_type_id: h.get('x-screening-type-id') ?? undefined,
    difficulty: (h.get('x-difficulty') as SessionUser['difficulty']) ?? undefined,
  }
}
