# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                              Vercel                                  │
│                                                                      │
│  ┌────────────────────┐    ┌─────────────────────────────────────┐  │
│  │  Edge Middleware   │    │   Next.js App Router                │  │
│  │                    │    │                                     │  │
│  │  1. Read JWT cookie│───▶│  Server Components (RSC)            │  │
│  │  2. Verify cg_     │    │  ├── session/[id]      (interviewee)│  │
│  │     session cookie │    │  ├── (staff)/dashboard              │  │
│  │  3. RBAC path check│    │  ├── (staff)/screening/[id]         │  │
│  │  4. Set user header│    │  ├── (management)/candidates        │  │
│  └────────────────────┘    │  └── (admin)/questions              │  │
│                             │                                     │  │
│                             │  Route Handlers (Node.js)           │  │
│                             │  ├── /api/auth/me        ←──────┐  │  │
│                             │  ├── /api/execute         ←──┐  │  │  │
│                             │  └── /api/* (CRUD)           │  │  │  │
│                             └────────────┬────────────────┘ │  │  │  │
└────────────────────────────────────────┼──────────────────┼──┼──┘  │
                                          │                  │  │      │
           ┌──────────────────────────────┘          ┌───────┘  │      │
           │ HTTPS                                    │          │      │
           ▼                                          ▼          │      │
┌──────────────────────┐                 ┌────────────────────┐ │      │
│  Google Sheets API   │                 │   Piston API       │ │      │
│  (Single Workbook)   │                 │   (Code Execution) │ │      │
│                      │                 │                    │ │      │
│  roles               │                 │  /execute          │ │      │
│  screening_types     │                 │  40+ languages     │ │      │
│  questions           │                 │  sandboxed         │ │      │
│  candidates          │                 └────────────────────┘ │      │
│  screenings          │                                         │      │
│  responses           │          ┌──────────────────────────────┘      │
│  code_submissions    │          │ HTTPS                                │
│  drawings            │          ▼                                      │
│  users               │  ┌─────────────────────┐                       │
└──────────────────────┘  │  External Auth      │                       │
                           │  <domain>/auth/me/  │                       │
                           │  JWT in cookie      │                       │
                           └─────────────────────┘                       │
```

## Role Hierarchy & Route Access

```
admin ──────────► /admin/*        (questions CRUD, user management)
  │                (management)/* (all candidates, all screenings)
  │                (staff)/*      (all screening sessions, dashboard)
  │
manager ─────────► (management)/* (all candidates, all screenings)
  │                (staff)/*      (all screening sessions, dashboard)
  │
interviewer ─────► (staff)/*      (assigned screenings, candidate activity)
  │
interviewee ─────► /session/[id]  (own session only — scoped by token claims)
```

## Auth Flow

```
Browser sends request with cookies:
  access_token=<external JWT>   (from the existing auth system)
  cg_session=<our signed JWT>   (if previously established)

Edge Middleware:
  if cg_session present and valid:
    → extract user from cg_session
    → RBAC path check
    → pass x-user-id, x-user-role headers to RSC
  else if access_token present:
    → Node.js /api/auth/me route handler
    → calls EXTERNAL_AUTH_URL/auth/me/ forwarding access_token cookie
    → receives { id, name, email, role, role_id?, screening_type_id?, difficulty? }
    → signs new cg_session JWT (jose, SESSION_SECRET, 8h TTL)
    → sets cg_session cookie (httpOnly, sameSite=strict)
    → RBAC path check
  else:
    → 401 / redirect to external login URL
```

### Interviewee Token Claims

When the external auth returns claims for an interviewee, their session includes:
- `role_id` — restricts question queries to their job role
- `screening_type_id` — restricts to their interview stage
- `difficulty` — restricts to their assigned difficulty tier

These are enforced in `GET /api/questions` and `GET /api/screenings/[id]` when the caller is `interviewee`.

## Question Type Rendering

```
Question.type === 'text'
  → TextQuestion component
  → Display question text, category, difficulty badge
  → Interviewer: score 1-5 + notes
  → Interviewee: read-only (answer verbally)

Question.type === 'code'
  → CodeQuestion component
  → Monaco Editor (dynamic import, ssr:false)
  → Language selector (defaults to question.language)
  → Run button → POST /api/execute → Piston API → stdout/stderr/exitcode
  → Interviewee: write + run code, submit
  → Interviewer: read-only Monaco view of submitted code, execution result, score + notes

Question.type === 'system_design'
  → DesignQuestion component
  → Excalidraw canvas (dynamic import, ssr:false)
  → Interviewee: draw, auto-save every 30s → POST /api/drawings
  → Interviewer: read-only Excalidraw view of saved JSON, score + notes
```

## Live Session Data Flow

```
Interviewee arrives at /session/[screeningId]
  │
  ▼
RSC: load screening (scope-checked against token claims)
     load questions for this role + screening_type
  │
  ▼
Client: useSession Zustand store hydrated with questions
        Renders question by type (TextQuestion / CodeQuestion / DesignQuestion)
  │
  For code questions:
    Interviewee writes code in Monaco
    Clicks Run → POST /api/execute → Piston → result shown in console pane
    Clicks Submit → POST /api/code-submissions → saved to sheets
  │
  For system_design questions:
    Interviewee draws in Excalidraw
    Auto-save every 30s → POST /api/drawings → sheets
    Manual save also available
  │
  ▼
Interviewer (in /screening/[id]):
  Sees submitted code in read-only Monaco
  Sees latest drawing in read-only Excalidraw
  Scores 1-5 + notes per question
  Final: overall score + recommendation + submit
  │
  ▼
POST /api/responses + PATCH /api/screenings/[id]
Writes to Google Sheets
Candidate dashboard updates
```

## Caching Strategy

| Data | Cache | Why |
|------|-------|-----|
| Questions | ISR 60s | Read-heavy, admin updates infrequently |
| Roles | ISR 300s | Almost never changes |
| Screening Types | ISR 300s | Almost never changes |
| Screenings | No cache | Live session state |
| Responses | No cache | Real-time scoring |
| Code Submissions | No cache | Real-time activity |
| Drawings | No cache | Real-time activity |

## Code Execution (Piston)

```
POST /api/execute
  Body: { language, code, stdin? }
  Auth: any authenticated role
  │
  ▼
  Validate language is in SUPPORTED_LANGUAGES list
  POST to CODE_EXECUTION_URL/api/v2/execute
    { language, version: "*", files: [{ content: code }], stdin }
  │
  ▼
  Return: { stdout, stderr, exit_code, run_time_ms }
  Timeout: 10s (Next.js route timeout)
  Memory limit: enforced by Piston config
```

## System Design Storage

Excalidraw state is a JSON object (~5-50KB for typical diagrams). Stored as a JSON string in the `drawings` sheet tab. For unusually large diagrams (>100KB), the app falls back to Vercel Blob Storage — the `drawings.excalidraw_json` column then stores the Blob URL instead of inline JSON. This is transparent to the reader: check if value starts with `https://` to determine which storage was used.
