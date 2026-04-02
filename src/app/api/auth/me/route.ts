import { NextRequest, NextResponse } from 'next/server'
import { fetchExternalUser } from '@/lib/auth/external'
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/config'

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('access_token')?.value
  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 })
  }

  let user
  try {
    user = await fetchExternalUser(accessToken)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessionToken = await createSession(user)
  const res = NextResponse.json(user)
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
  return res
}
