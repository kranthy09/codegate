# Phase 6: Candidate Dashboard & External Reporting API

**Two parallel systems:**
1. **Internal Dashboard** — staff view of candidate pipeline, stages, scores, code history, drawings
2. **External API** — 3rd-party ATS/HR tools read candidate pipeline via JWT-protected endpoints

The external API layer allows HR platforms, ATS systems, and recruiting dashboards to consume CodeGate assessment data from Google Sheets without direct sheet access. All data flows through Google Sheets as the single source of truth.

## Implementation Status

✅ **Complete** — All internal dashboards, external APIs, and UI components fully implemented.

## Key Files Created

| File | Purpose |
|------|---------|
| `src/lib/sheets/mutations.ts` (edit) | Added `patchApiKey()` for PATCH /api/admin/api-keys/[id] |
| `src/app/api/candidates/[id]/activity/route.ts` | GET endpoint — code submissions + drawings grouped by screening |
| `src/app/api/external/auth/route.ts` | POST endpoint — validate external API key (test endpoint) |
| `src/app/api/external/candidates/[id]/pipeline/route.ts` | GET endpoint — per-candidate pipeline snapshots for ATS sync |
| `src/app/api/admin/api-keys/[id]/route.ts` (edit) | Added PATCH handler for update/revoke + DELETE implementation |
| `src/components/dashboard/performance-summary.tsx` | Server component — aggregate stats: avg score, stage progress, recommendations |
| `src/components/dashboard/pipeline-stages.tsx` | Server component — visual stage progression with status badges |
| `src/components/dashboard/code-history.tsx` | Client component — read-only Monaco viewer for code submissions |
| `src/components/dashboard/drawing-history.tsx` | Client component — read-only Excalidraw viewer for system design drawings |
| `src/components/dashboard/screening-detail.tsx` | Client component — collapsible screening card with expand/collapse |
| `src/app/(management)/candidates/page.tsx` | RSC — candidate list with search by name/email |
| `src/app/(management)/candidates/candidates-list-client.tsx` | Client component — search UI + candidate table |
| `src/app/(management)/candidates/[id]/page.tsx` | RSC — full candidate dashboard: performance, pipeline, screening details |
| `src/app/(staff)/dashboard/page.tsx` | RSC — staff home: active screenings table (RBAC-filtered per role) |

## Key Files

```
src/app/api/candidates/route.ts
src/app/api/candidates/[id]/route.ts
src/app/api/candidates/[id]/activity/route.ts
src/app/(management)/candidates/page.tsx
src/app/(management)/candidates/[id]/page.tsx
src/app/(staff)/dashboard/page.tsx
src/lib/auth/external-api.ts                  # NEW
src/app/api/external/auth/route.ts            # NEW
src/app/api/external/candidates/route.ts      # NEW
src/app/api/external/candidates/[id]/pipeline/route.ts  # NEW
src/app/api/external/screenings/[id]/route.ts # NEW
src/app/api/external/reports/route.ts         # NEW
src/app/api/admin/api-keys/route.ts           # NEW
src/components/dashboard/
  pipeline-stages.tsx
  screening-detail.tsx
  code-history.tsx
  drawing-history.tsx
  performance-summary.tsx
```

## Candidate Dashboard Layout

```
┌──────────────────────────────────────────────────────────┐
│ Jane Smith                               [active ▼]      │
│ Backend Engineer · jane@example.com                      │
├──────────────────────────────────────────────────────────┤
│ Pipeline Progress                                        │
│ ✓ HR Screen → ✓ Tech Screen → ✓ Tech Interview          │
│                             → ● System Design [current]  │
│                             → ○ Behavioral               │
├──────────────────────────────────────────────────────────┤
│ Overall Average: 3.9/5  ·  3 of 5 stages complete       │
│ Consensus: Likely Yes (2× yes, 1× strong_yes)           │
├──────────────────────────────────────────────────────────┤
│ ▼ Technical Interview  [4.0/5 · yes · Alex J.]          │
│                                                          │
│  [TEXT] Explain event loop          4/5                  │
│  [CODE] Two-sum O(n)                3/5                  │
│    └─ 3 submissions · last: 14:32                        │
│       [View code ▼]                                      │
│       ┌───────────────────────────────────┐              │
│       │ def two_sum(nums, target):        │ (read-only)  │
│       │     seen = {}                     │              │
│       │     ...                           │              │
│       └───────────────────────────────────┘              │
│  [DESIGN] Design URL shortener      4/5                  │
│    └─ [View drawing ▼]                                   │
│       ┌───────────────────────────────────┐              │
│       │  [Excalidraw snapshot, read-only] │              │
│       └───────────────────────────────────┘              │
│                                                          │
│ ▶ Technical Phone Screen  [3.5/5 · yes · Sam K.]        │
│ ▶ HR Screen               [4.0/5 · strong_yes · —]      │
└──────────────────────────────────────────────────────────┘
```

## External API Architecture

### Overview
External ATS/HR tools authenticate using **Bearer token** (separate from `cg_session`):
```
GET /api/external/candidates/[id]/pipeline
Authorization: Bearer <api_key>
```

Middleware intercepts `/api/external/*` routes:
1. Extract key from `Authorization: Bearer ...` header
2. Hash key with `crypto.subtle.digest('SHA-256', key)`
3. Look up in `api_keys` tab by hashed_key
4. Check `active == TRUE` and scope permissions
5. Update `last_used_at` timestamp
6. Call route handler, else return 401 Unauthorized

### External API Endpoints

**POST /api/external/auth** — Validate external API key
```json
// Request
{ "key": "api_key_..." }
// Response (200)
{ "valid": true, "scope": ["candidates", "screenings", "reports"], "expires_at": "2026-05-01T00:00:00Z" }
// Response (401)
{ "error": "Invalid or expired key" }
```

**GET /api/external/candidates** — List all candidates with latest pipeline status
```json
// Response (200)
{
  "candidates": [
    {
      "id": "cand_001",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "applied_role_id": "role_fe_001",
      "status": "active",
      "latest_screening": {
        "screening_type_id": "st_tech_001",
        "status": "completed",
        "overall_score": 4,
        "recommendation": "yes",
        "completed_at": "2026-04-01T15:30:00Z"
      }
    }
  ],
  "total": 42,
  "page": 1
}
```

**GET /api/external/candidates/[id]/pipeline** — Full candidate pipeline (for ATS sync)
```json
{
  "candidate": { "id", "name", "email", "applied_role_id", "status", "created_at" },
  "pipeline_snapshots": [
    {
      "id": "pipe_001",
      "screening_id": "scr_001",
      "screening_type_id": "st_hr_001",
      "status": "completed",
      "overall_score": 4,
      "recommendation": "yes",
      "responses_json": [
        { "question_id": "q_001", "question_type": "text", "question_text": "...", "score": 4, "notes": "..." }
      ],
      "code_submissions_json": [...],
      "drawings_json": [...],
      "completed_at": "2026-04-01T15:30:00Z"
    }
  ]
}
```

**GET /api/external/screenings/[id]** — Single screening with all data (for detailed review)
```json
{
  "screening": { "id", "candidate_id", "role_id", "screening_type_id", "status", "overall_score", "recommendation" },
  "candidate": { "name", "email" },
  "responses": [
    { "question_id": "q_001", "question_type": "text", "score": 4, "notes": "..." }
  ],
  "code_submissions": [
    { "question_id": "q_002", "language": "python", "code": "...", "exit_code": 0 }
  ],
  "drawings": [
    { "question_id": "q_003", "excalidraw_json": "..." }
  ]
}
```

**GET /api/external/reports?role_id=role_fe_001&status=completed&from=2026-01-01&to=2026-04-30** — Aggregated reports
```json
{
  "filters": { "role_id": "role_fe_001", "status": "completed", "from": "2026-01-01", "to": "2026-04-30" },
  "candidates": [...],
  "summary": {
    "total_candidates": 42,
    "total_completed_screenings": 120,
    "average_score": 3.7,
    "recommendation_distribution": { "strong_yes": 25, "yes": 45, "neutral": 30, "no": 15, "strong_no": 5 }
  }
}
```

### API Key Management (Admin only)

**POST /api/admin/api-keys** — Create new external API key
```json
// Request
{ "name": "ATS Sync - Lever", "scope": ["candidates", "screenings", "reports"] }
// Response (201)
{ "id": "api_key_001", "name": "ATS Sync - Lever", "key": "pk_live_...", "scope": [...], "created_at": "..." }
// Note: Key returned only once; customer must store it
```

**GET /api/admin/api-keys** — List all keys (admin only)
```json
{
  "keys": [
    {
      "id": "api_key_001",
      "name": "ATS Sync - Lever",
      "scope": ["candidates", "screenings", "reports"],
      "created_at": "2026-01-15T10:00:00Z",
      "last_used_at": "2026-04-01T14:32:00Z",
      "active": true
    }
  ]
}
```

**PATCH /api/admin/api-keys/[id]** — Revoke or update key metadata
```json
// Request
{ "active": false }  // OR { "name": "new name" }
// Response (200)
{ "id": "api_key_001", "active": false, "updated_at": "..." }
```

**DELETE /api/admin/api-keys/[id]** — Hard delete key (cleanup only, doesn't invalidate)
```json
// Response (204)
```

---

## Performance Calculation (server-side)

```typescript
function computePerformance(screenings: Screening[]): CandidatePerformance {
  const completed = screenings.filter(s => s.status === 'completed')

  const average_score = completed.length
    ? Number(
        (completed.reduce((sum, s) => sum + (s.overall_score ?? 0), 0) / completed.length).toFixed(1)
      )
    : null

  const recommendation_counts = completed.reduce((acc, s) => {
    if (s.recommendation) acc[s.recommendation] = (acc[s.recommendation] ?? 0) + 1
    return acc
  }, {} as Partial<Record<Recommendation, number>>)

  return {
    average_score,
    completed_stages: completed.length,
    total_stages: screenings.length,
    recommendation_counts,
  }
}
```

## Activity API (`GET /api/candidates/[id]/activity`)

Returns all code submissions and drawings for a candidate, grouped by screening and question:

```json
{
  "by_screening": {
    "scr_001": {
      "code_submissions": {
        "q_002": [
          { "id": "cs_001", "code": "...", "stdout": "[1,3]", "exit_code": 0, "submitted_at": "..." }
        ]
      },
      "drawings": {
        "q_003": { "excalidraw_json": "...", "submitted_at": "..." }
      }
    }
  }
}
```

## RBAC Rules

### Internal Routes (require `cg_session` cookie)

| Route | admin | manager | interviewer | interviewee |
|-------|-------|---------|-------------|-------------|
| GET /api/candidates | ✓ | ✓ | ✗ | ✗ |
| GET /api/candidates/[id] | ✓ | ✓ | own only | ✗ |
| GET /api/candidates/[id]/activity | ✓ | ✓ | own only | ✗ |
| PATCH /api/candidates/[id] (status) | ✓ | ✓ | ✗ | ✗ |

"Own only" for interviewer means screenings where `interviewer_id === session.id` only.

### External API Routes (require `Authorization: Bearer <api_key>` header)

| Route | Scope Required | Cached |
|-------|----------------|--------|
| POST /api/external/auth | any valid key | no |
| GET /api/external/candidates | `candidates` | 5m (ISR) |
| GET /api/external/candidates/[id]/pipeline | `candidates` | 5m (ISR) |
| GET /api/external/screenings/[id] | `screenings` | 5m (ISR) |
| GET /api/external/reports | `reports` | 1h (ISR) |
| POST /api/admin/api-keys | admin (cg_session) | no |
| GET /api/admin/api-keys | admin (cg_session) | no |
| PATCH /api/admin/api-keys/[id] | admin (cg_session) | no |
| DELETE /api/admin/api-keys/[id] | admin (cg_session) | no |

External API keys are **separate from** internal `cg_session`. Each external key has a specific scope (e.g., `candidates`, `screenings`, `reports`) and cannot access routes outside its scope.

## Staff Dashboard (`/(staff)/dashboard`)

Interviewer home page. Shows their assigned screenings with live status:

```
┌───────────────────────────────────────────────────────┐
│ My Screenings                                         │
├───────────────────────────────────────────────────────┤
│ Jane Smith   Technical Interview  ● in_progress       │
│ Mark Lee     HR Screen            ○ scheduled         │
│ Amy Chen     System Design        ✓ completed  [View] │
└───────────────────────────────────────────────────────┘
```

Admin and manager dashboard shows all screenings, all candidates, filterable by stage and status.

## Acceptance Criteria

### Internal Dashboard
- Candidate dashboard aggregates all screenings with scores, recommendations, and interviewer names
- Per-screening detail expands to show individual question scores
- Code submissions visible in read-only Monaco within expanded detail
- Drawings visible in read-only Excalidraw within expanded detail
- Average score and stage count computed server-side (no client calculation)
- Interviewer sees only candidates they are assigned to
- Admin/manager sees all candidates
- Candidate status (active/hired/rejected/hold) can be updated by admin/manager

### External API
- External API keys created by admin with specific scopes
- Keys stored as SHA-256 hashes in `api_keys` tab (plaintext never stored)
- Each request validates `Authorization: Bearer <key>` header
- Routes return only data matching key's scope
- `GET /api/external/candidates/[id]/pipeline` returns full `CandidatePipelineSnapshot[]` from candidate_pipeline tab
- `GET /api/external/screenings/[id]` returns complete question+answer+code+drawing data
- External tools can integrate CodeGate assessment data into ATS/HR dashboards
- All external API data sourced from Google Sheets (no duplicate database)
- `last_used_at` timestamp updated on every external API call for audit trail
- Key rotation (revoke old, create new) supported via admin endpoints
