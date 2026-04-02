# Phase 2: Auth & RBAC

Custom authentication using an external auth service. No Google OAuth, no NextAuth. The external system issues a JWT stored in the user's browser cookie. Our app verifies it, looks up the user's role, and maintains its own short-lived signed session.

## Status: Complete

## Tasks

- [x] Implement `src/lib/auth/external.ts` — call `EXTERNAL_AUTH_URL/auth/me/`
- [x] Implement `src/lib/auth/session.ts` — sign/verify `cg_session` using jose
- [x] Implement `src/app/api/auth/me/route.ts` — establish session from external token
- [x] Implement `src/app/api/auth/logout/route.ts` — clear session cookie
- [x] Implement `src/middleware.ts` — verify session, RBAC path check, set user headers
- [x] Implement layout guards: `(staff)/layout.tsx`, `(management)/layout.tsx`, `(admin)/layout.tsx`
- [x] Implement `src/lib/utils.ts` → `requireRole()` helper used in every API route
- [x] Implement `src/lib/auth/external-api.ts` → `validateExternalApiKey()` — SHA-256 hash lookup + scope check
- [x] Implement `src/app/api/admin/api-keys/route.ts` — admin: list + create external API keys
- [x] Implement `src/app/api/admin/api-keys/[id]/route.ts` — admin: revoke external API key
- [x] Implement `src/app/api/external/candidates/route.ts` — external: list candidates + pipeline
- [x] Implement `src/app/api/external/screenings/[id]/route.ts` — external: full screening with answers
- [x] Implement `src/app/api/external/reports/route.ts` — external: aggregated candidate reports
- [x] Update middleware matcher to exclude `/api/external` (routes handle their own key auth)
- [x] Remove dead `[...nextauth]` placeholder

## Key Files

```
src/lib/auth/
  external.ts        — calls external /auth/me/
  session.ts         — jose sign/verify for cg_session cookie
  config.ts          — getServerUser() reads headers set by middleware
  external-api.ts    — validateExternalApiKey(): hash + sheets lookup + scope check
src/middleware.ts
src/app/api/auth/
  me/route.ts
  logout/route.ts
src/app/api/admin/
  api-keys/route.ts           — GET list, POST create
  api-keys/[id]/route.ts      — DELETE revoke
src/app/api/external/
  candidates/route.ts          — scope: candidates
  screenings/[id]/route.ts     — scope: screenings
  reports/route.ts             — scope: reports
src/app/(staff)/layout.tsx
src/app/(management)/layout.tsx
src/app/(admin)/layout.tsx
```

## External Auth Call (`lib/auth/external.ts`)

```typescript
export async function fetchExternalUser(accessToken: string): Promise<SessionUser> {
  const res = await fetch(`${process.env.EXTERNAL_AUTH_URL}/auth/me/`, {
    headers: { Cookie: `access_token=${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`External auth failed: ${res.status}`)
  return res.json() as Promise<SessionUser>
}
```

## Internal Session (`lib/auth/session.ts`)

Uses `jose` to sign and verify a compact JWT stored in `cg_session` cookie.

```typescript
import { SignJWT, jwtVerify } from 'jose'

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
```

`verifySession` is edge-compatible — jose uses Web Crypto, not Node.js crypto.

## Session Establishment (`/api/auth/me`)

```typescript
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('access_token')?.value
  if (!accessToken) return NextResponse.json({ error: 'No access token' }, { status: 401 })

  const user = await fetchExternalUser(accessToken)
  const sessionToken = await createSession(user)
  const res = NextResponse.json(user)
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true, sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE, path: '/',
  })
  return res
}
```

## Middleware Pattern (`middleware.ts`)

Runs at edge. Only reads/verifies `cg_session` — no external calls here. Falls back to `access_token` cookie if no session exists (re-establishes via `fetchExternalUser`). Excludes `/api/external/*` from session-based auth — those routes validate their own API keys.

```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|api/external).*)'],
}
```

## External API Key Validation (`lib/auth/external-api.ts`)

```typescript
export async function validateExternalApiKey(
  authHeader: string | null,
  requiredScope: ExternalApiScope,
): Promise<ApiKey> {
  // 1. Parse Bearer token
  // 2. SHA-256 hash it
  // 3. getApiKeyByHash(hash) — must be active
  // 4. Check key.scope.includes(requiredScope)
  // 5. void updateApiKeyLastUsed(key.id)  — non-blocking audit
  return key
}
```

External route handler pattern:
```typescript
export async function GET(req: NextRequest) {
  try {
    await validateExternalApiKey(req.headers.get('authorization'), 'candidates')
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
  // ... return data
}
```

## RSC Session Helper

In Server Components, read user from headers set by middleware:

```typescript
// lib/auth/config.ts
export async function getServerUser(): Promise<SessionUser | null> {
  const h = await headers()
  const id = h.get('x-user-id')
  const role = h.get('x-user-role') as SessionUser['role'] | null
  if (!id || !role) return null
  return { id, name: h.get('x-user-name') ?? '', email: h.get('x-user-email') ?? '', role, ... }
}
```

## API Route RBAC Helper

```typescript
// lib/utils.ts
export class UnauthorizedError extends Error { status = 403 }

export function requireRole(user: SessionUser | null, allowed: UserRole[]): asserts user is SessionUser {
  if (!user || !allowed.includes(user.role)) throw new UnauthorizedError()
}
```

Every internal API route starts with:
```typescript
const user = await getServerUser()
requireRole(user, ['admin', 'manager'])
```

## Layout Guards

```typescript
// (admin)/layout.tsx
export default async function AdminLayout({ children }) {
  const user = await getServerUser()
  if (user?.role !== 'admin') redirect('/dashboard')
  return <>{children}</>
}
```

Same pattern for `(management)` (admin+manager) and `(staff)` (admin+manager+interviewer).

## External API Keys — Admin Management

| Method | Route | Action |
|--------|-------|--------|
| GET | `/api/admin/api-keys` | List all keys (hashed_key omitted) |
| POST | `/api/admin/api-keys` | Create key — returns plaintext once |
| DELETE | `/api/admin/api-keys/:id` | Revoke key (sets active=FALSE) |

Plaintext key is never stored — only the SHA-256 hash persists in the `api_keys` sheet.

## External Reporting API Endpoints

| Route | Scope | Returns |
|-------|-------|---------|
| `GET /api/external/candidates` | `candidates` | All candidates with pipeline snapshots |
| `GET /api/external/screenings/:id` | `screenings` | Screening + candidate + responses + code + drawings |
| `GET /api/external/reports` | `reports` | Aggregated per-candidate performance + stage breakdown |

All external routes:
- Require `Authorization: Bearer <plaintext-key>` header
- Return `401` on invalid/revoked/wrong-scope key
- Are excluded from session-based middleware (matcher regex)

## Acceptance Criteria

- [x] A request with no cookies → `401 Unauthorized`
- [x] Valid `cg_session` → middleware passes through without external call
- [x] Expired `cg_session` → middleware re-establishes from `access_token` cookie
- [x] `admin` → can access `/admin/*`, `/(management)/*`, `/(staff)/*`
- [x] `manager` → blocked from `/admin/*`, can access `/(management)/*`
- [x] `interviewer` → blocked from `/admin/*` and `/(management)/*`
- [x] `interviewee` → only `/session/[id]` (all staff paths blocked)
- [x] `requireRole()` throws 403 in API routes for unauthorized callers
- [x] External API key with wrong scope → 401
- [x] Revoked external API key → 401 (getApiKeyByHash filters active=FALSE)
- [x] Valid external key → `last_used_at` updated (non-blocking)
