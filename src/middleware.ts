import { NextRequest, NextResponse } from 'next/server'
import { verifySession, createSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/session'
import { fetchExternalUser } from '@/lib/auth/external'

// Role → path prefixes accessible (checked via startsWith)
const ROLE_PATH_RULES: Record<string, string[]> = {
  '/admin':       ['admin'],
  '/management':  ['admin', 'manager'],
  '/staff':       ['admin', 'manager', 'interviewer'],
  '/session':     ['admin', 'manager', 'interviewer', 'interviewee'],
}

function isAllowed(role: string, pathname: string): boolean {
  for (const [prefix, allowed] of Object.entries(ROLE_PATH_RULES)) {
    if (pathname.startsWith(prefix) && !allowed.includes(role)) return false
  }
  return true
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Try existing internal session
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value
  if (sessionToken) {
    const user = await verifySession(sessionToken)
    if (user) {
      if (!isAllowed(user.role, pathname)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      // Attach user to downstream request headers
      const res = NextResponse.next()
      res.headers.set('x-user-id', user.id)
      res.headers.set('x-user-name', user.name)
      res.headers.set('x-user-email', user.email)
      res.headers.set('x-user-role', user.role)
      if (user.role_id) res.headers.set('x-role-id', user.role_id)
      if (user.screening_type_id) res.headers.set('x-screening-type-id', user.screening_type_id)
      if (user.difficulty) res.headers.set('x-difficulty', user.difficulty)
      return res
    }
    // Expired or invalid — fall through to re-auth
  }

  // No valid session — try external auth token
  const accessToken = req.cookies.get('access_token')?.value
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let user
  try {
    user = await fetchExternalUser(accessToken)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAllowed(user.role, pathname)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Create new internal session
  const newSessionToken = await createSession(user)
  const res = NextResponse.next()
  res.cookies.set(SESSION_COOKIE, newSessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
  res.headers.set('x-user-id', user.id)
  res.headers.set('x-user-name', user.name)
  res.headers.set('x-user-email', user.email)
  res.headers.set('x-user-role', user.role)
  if (user.role_id) res.headers.set('x-role-id', user.role_id)
  if (user.screening_type_id) res.headers.set('x-screening-type-id', user.screening_type_id)
  if (user.difficulty) res.headers.set('x-difficulty', user.difficulty)

  return res
}

export const config = {
  // Exclude: Next.js internals, favicon, auth routes (handle their own), external API routes (key-auth in handler)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|api/external).*)'],
}
