# CodeGate — Interview Portal

## Purpose
End-to-end interview pipeline: define questions in Google Sheets → live screening sessions (text / code / system design) → real-time scoring → sync results to Sheets (including denormalized pipeline snapshots) → candidate performance dashboard + external reporting API for ATS/HR tool integration.

## Tech Stack

| Layer | Tool | Reason |
|-------|------|--------|
| Framework | Next.js 15 (App Router) | Vercel-native, RSC, ISR |
| Language | TypeScript strict | Type safety across sheets schema |
| Styling | Tailwind CSS + Radix UI | Accessible, no runtime CSS |
| Auth | Custom JWT + `jose` | External `/auth/me/` with cookie-based JWT — no OAuth |
| Data | Google Sheets API v4 | Sheets as live database |
| State | Zustand | Client-only screening session |
| Code Editor | Monaco Editor (`@monaco-editor/react`) | VSCode engine, MIT, 30+ languages |
| Drawing | Excalidraw (`@excalidraw/excalidraw`) | MIT, production-grade collaborative whiteboard |
| Code Execution | Piston API (self-hosted or public) | Open source, sandboxed, 40+ languages |
| Deployment | Vercel | Edge middleware, ISR, env |

## Role Hierarchy (top → bottom)

| Role | Slug | Access |
|------|------|--------|
| Administrator | `admin` | Full access — users, questions, all candidates, all screenings |
| Manager | `manager` | All candidates + screenings, assign interviewers, view activity |
| Interviewer | `interviewer` | Their assigned screenings, candidate activity during session |
| Interviewee | `interviewee` | Their own session only — write code, draw, answer questions |

## Question Types

| Type | Slug | Rendered As | Scored By |
|------|------|-------------|-----------|
| Written Q&A | `text` | Text display + score input | Interviewer |
| DSA / Coding | `code` | Monaco Editor + execution console | Interviewer |
| System Design | `system_design` | Excalidraw canvas | Interviewer |

## Folder Map

```
src/
├── app/
│   ├── session/[id]/          # Interviewee live session (all question types)
│   ├── (staff)/               # Protected: interviewer + manager + admin
│   │   ├── dashboard/         # Active screenings, candidate list
│   │   ├── screening/new/     # Create screening
│   │   └── screening/[id]/    # Interviewer view: live candidate activity + scoring
│   ├── (management)/          # Protected: manager + admin
│   │   └── candidates/
│   │       ├── page.tsx       # Candidate list
│   │       └── [id]/page.tsx  # Candidate pipeline dashboard
│   ├── (admin)/               # Protected: admin only
│   │   ├── questions/         # Question bank CRUD
│   │   └── users/             # User management
│   └── api/
│       ├── auth/me/           # Proxy to external auth, set internal session
│       ├── auth/logout/       # Clear internal session
│       ├── questions/
│       ├── candidates/
│       ├── screenings/
│       ├── responses/
│       ├── code-submissions/
│       ├── drawings/
│       ├── execute/           # Code execution proxy to Piston
│       ├── roles/
│       ├── screening-types/
│       ├── external/           # External reporting API (ATS/HR integration)
│       │   ├── auth/          # Validate external API key
│       │   ├── candidates/    # List candidates + pipeline summary
│       │   ├── screenings/    # Get screening with all answers
│       │   └── reports/       # Aggregated candidate reports
│       └── admin/
│           └── api-keys/      # Manage external API keys
├── components/
│   ├── ui/                    # Radix-based primitives
│   ├── screening/             # Interviewer scoring view
│   ├── session/               # Interviewee live session components
│   │   ├── text-question.tsx  # Q&A question display
│   │   ├── code-question.tsx  # Monaco + run button + output
│   │   └── design-question.tsx# Excalidraw canvas + save
│   ├── questions/             # Question bank filter + cards
│   └── dashboard/             # Performance + pipeline views
├── lib/
│   ├── sheets/
│   │   ├── client.ts          # Authenticated Sheets API instance + RANGES
│   │   ├── queries.ts         # All read operations
│   │   └── mutations.ts       # All write/append/update operations
│   ├── auth/
│   │   ├── session.ts         # Internal session: sign/verify with jose
│   │   ├── external.ts        # Calls EXTERNAL_AUTH_URL/auth/me/ (user auth)
│   │   ├── external-api.ts    # Validate external API keys (reporting API)
│   │   └── config.ts          # Auth helpers: getServerUser(), requireRole()
│   └── utils.ts               # cn(), formatDate(), rbac helpers
├── types/
│   └── index.ts               # All domain types (single source)
└── hooks/
    ├── use-screening.ts        # Zustand: interviewer scoring session
    └── use-session.ts          # Zustand: interviewee live session state
```

## Coding Rules

1. **Server Components by default** — `"use client"` only for event handlers, Monaco, Excalidraw, or Zustand.
2. **Sheets API only in `lib/sheets/`** — never directly from components or route handlers.
3. **All types in `src/types/index.ts`** — no inline type definitions in components.
4. **Route handlers are thin** — validate input, check auth (role or API key), call lib function, return response.
5. **RBAC in internal API routes** — call `requireRole(session, ['admin','manager'])` at top. Never trust client-sent role values.
6. **External API key validation in `/api/external/*` routes** — call `validateExternalApiKey(authHeader)` → check scope matches route.
7. **Pipeline snapshots atomic** — when interviewer submits review, build `CandidatePipelineSnapshot`, append to `candidate_pipeline` sheet atomically with responses + screening update.
8. **ISR for read-heavy data** — questions, roles, screening_types, external reports. No cache for screenings, responses, code submissions, api_keys, candidate_pipeline.
9. **No `any`** — use `unknown` and narrow.
10. **Env vars** — `GOOGLE_*`, `EXTERNAL_AUTH_URL`, `SESSION_SECRET`, `CODE_EXECUTION_URL` are server-only. Never `NEXT_PUBLIC_` prefix them.
11. **Monaco and Excalidraw** — dynamic import with `ssr: false`. These are browser-only.
12. **Code execution** — always proxied through `/api/execute`. Never call Piston directly from client.

## Auth Pattern (No OAuth)

The external system (your existing auth server) issues a JWT stored in the user's cookie. Our app:
1. Middleware reads the external JWT cookie (`access_token`)
2. On first hit or session expiry: calls `EXTERNAL_AUTH_URL/auth/me/` → gets `{ id, name, email, role, role_id?, screening_type_id?, difficulty? }`
3. Creates our own short-lived signed session (jose JWT, `SESSION_SECRET`) stored in `cg_session` cookie
4. Subsequent requests: verify `cg_session` locally at edge — fast, no external call
5. On session expiry: re-verify with external service

Interviewee tokens include `role_id`, `screening_type_id`, `difficulty` — data queries are automatically scoped to these values.

## External Reporting API Pattern

Separate from internal auth (`cg_session`), 3rd-party ATS/HR tools access candidate pipeline data via JWT bearer tokens stored in the `api_keys` sheet:

1. Admin creates API key via `/api/admin/api-keys` → returns plaintext key (shown once)
2. External tool stores key securely, sends in `Authorization: Bearer <key>` header
3. Middleware validates key: hash + check against `api_keys` tab, verify `active=TRUE`, check scope
4. Route handler returns data from Google Sheets — no separate database
5. `last_used_at` timestamp updated for audit trail
6. Key can be revoked by admin (set `active=FALSE`) — subsequent calls return 401

External endpoints are scoped: `candidates`, `screenings`, `reports` — keys can be restricted to specific scopes.

## Sheet Schema Quick Reference

| Tab | Purpose |
|-----|---------|
| `roles` | Job roles (Frontend Engineer, Backend Engineer, etc.) |
| `screening_types` | Pipeline stages in order (HR Screen → Technical → System Design, etc.) |
| `questions` | Question bank: text/code/system_design questions with rubrics |
| `candidates` | Candidate profiles with applied role and status |
| `screenings` | Screening sessions: candidate × stage assignments |
| `responses` | Question scores and notes from interviewers |
| `code_submissions` | Code submissions with execution results |
| `drawings` | System design drawings (Excalidraw JSON) |
| `users` | Staff (admin, manager, interviewer) |
| `candidate_pipeline` | **Denormalized snapshot of all candidate data per screening** — used by external APIs for fast ATS sync |
| `api_keys` | **External API keys for ATS/HR tool integration** — hashed, with scope and audit trail |

Full schema → `docs/reference/data-schema.md`

## RBAC Quick Reference

```typescript
// lib/utils.ts
const ROLE_LEVELS = { admin: 4, manager: 3, interviewer: 2, interviewee: 1 }

export function requireRole(session: Session, allowed: Role[]): void {
  if (!allowed.includes(session.role)) throw new UnauthorizedError()
}
```

## Vercel Deployment Constraints

- **No persistent file system** — all state in Google Sheets. Large Excalidraw JSONs → Vercel Blob (optional).
- **Serverless timeout** — Sheets API + Piston calls must complete < 10s. Use `Promise.all` for parallel reads.
- **Edge middleware** — auth checks only. `googleapis` is Node.js-only, never call it at edge.
- **Monaco + Excalidraw** — client-only, dynamic import with `ssr: false`.
- **Piston** — self-host on a separate VPS/container or use the public emkc.org endpoint. Our Vercel app calls it from a Node.js API route.

## Phase Map

| Phase | Name | Status |
|-------|------|--------|
| 0 | Scaffold | Done |
| 1 | Sheets Integration | Done |
| 2 | Auth & RBAC | Done |
| 3 | Question Bank | Done |
| 4 | Screening Flow (text + code + design) | Done |
| 5 | Review & Submit | Done |
| 6 | Candidate Dashboard | Done |
| 7 | Deployment | — |
