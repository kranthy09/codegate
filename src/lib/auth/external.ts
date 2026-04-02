import type { SessionUser } from '@/types'

export async function fetchExternalUser(accessToken: string): Promise<SessionUser> {
  const url = `${process.env.EXTERNAL_AUTH_URL}/auth/me/`
  const res = await fetch(url, {
    headers: { Cookie: `access_token=${accessToken}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`External auth failed: ${res.status}`)
  }

  return res.json() as Promise<SessionUser>
}
