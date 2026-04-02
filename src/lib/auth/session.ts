import { SignJWT, jwtVerify } from 'jose'
import type { SessionUser } from '@/types'

const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? 'dev-secret-change-me')
const ALG = 'HS256'
const TTL_SECONDS = Number(process.env.SESSION_TTL_HOURS ?? '8') * 3600

export const SESSION_COOKIE = 'cg_session'
export const SESSION_MAX_AGE = TTL_SECONDS

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret)
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}
