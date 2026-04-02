# API Routes Reference

All routes under `src/app/api/`. Every route reads the internal `cg_session` cookie and enforces RBAC. Returns JSON.

## RBAC Legend

| Symbol | Meaning |
|--------|---------|
| A | admin |
| M | manager |
| I | interviewer |
| C | interviewee (candidate) |

---

## Auth

### `GET /api/auth/me`
Called by middleware (and can be called by client) to establish or refresh the internal session.

- Reads external `access_token` cookie
- Calls `EXTERNAL_AUTH_URL/auth/me/` forwarding the cookie
- Signs and sets `cg_session` cookie (8h, httpOnly, sameSite=strict)
- Returns: `{ id, name, email, role, role_id?, screening_type_id?, difficulty? }`
- Roles: public (but requires valid external JWT)

### `POST /api/auth/logout`
Clears `cg_session` cookie. Returns `{ success: true }`.

---

## Roles

### `GET /api/roles`
Returns all job roles. ISR cached 300s.
- Roles: A, M, I

### `GET /api/screening-types`
Returns screening types ordered by `stage_order`. ISR cached 300s.
- Roles: A, M, I

---

## Questions

### `GET /api/questions`
Returns active questions. Filters via query params.

Query params:
- `role_id`
- `screening_type_id`
- `difficulty`
- `type` — `text`, `code`, `system_design`

RBAC scoping:
- A, M, I: can filter by any combination, see rubric + expected_answer
- C: `role_id`, `screening_type_id`, `difficulty` are forced from their session token claims. `rubric` and `expected_answer` are stripped from response.

Response:
```json
[{
  "id": "q_001",
  "type": "code",
  "text": "Implement binary search.",
  "difficulty": "medium",
  "category": "Binary Search",
  "starter_code": "def binary_search(arr, target):\n    pass",
  "language": "python",
  "active": true
}]
```

---

## Candidates

### `GET /api/candidates`
Returns all candidates with their pipeline status.
- Roles: A, M

### `POST /api/candidates`
Create a candidate record.
- Roles: A, M

Body:
```json
{ "name": "Jane Smith", "email": "jane@example.com", "applied_role_id": "role_fe_001" }
```

### `GET /api/candidates/[id]`
Candidate profile + all screenings + aggregated performance.
- Roles: A, M, I (interviewer sees only candidates they are assigned to)
- C: cannot access this endpoint

Response:
```json
{
  "candidate": { ... },
  "screenings": [{ ... }],
  "performance": {
    "average_score": 3.8,
    "completed_stages": 3,
    "total_stages": 5,
    "recommendation_counts": { "yes": 2, "strong_yes": 1 }
  }
}
```

### `GET /api/candidates/[id]/activity`
Get all code submissions and drawings for a candidate, grouped by screening.
- Roles: A, M, I (interviewer sees only their screenings for this candidate)

Response:
```json
{
  "by_screening": {
    "scr_001": {
      "code_submissions": [
        { "question_id": "q_002", "question_type": "code", "language": "python", "code": "...", "stdout": "...", "exit_code": 0, "submitted_at": "..." }
      ],
      "drawings": [
        { "question_id": "q_003", "question_type": "system_design", "excalidraw_json": "...", "submitted_at": "..." }
      ]
    }
  }
}
```

### `PATCH /api/candidates/[id]`
Update candidate status.
- Roles: A, M

Body: `{ "status": "hired" }`

---

## Screenings

### `GET /api/screenings`
Returns screenings visible to the caller.
- A, M: all screenings
- I: only screenings where `interviewer_id === session.id`
- C: only the screening matching their session claims

### `POST /api/screenings`
Create a new screening session.
- Roles: A, M, I

Body:
```json
{
  "candidate_id": "cand_001",
  "role_id": "role_fe_001",
  "screening_type_id": "st_tech_001"
}
```

Response: Created screening object with `id`.

### `GET /api/screenings/[id]`
Load a screening with its questions and candidate info.
- A, M, I: load interviewer view (includes rubric, expected_answer)
- C: load candidate view (rubric and expected_answer stripped), scoped to own screening

Response:
```json
{
  "screening": { ... },
  "questions": [{ ... }],
  "candidate": { ... }
}
```

### `PATCH /api/screenings/[id]`
Update screening after completion. Interviewer/admin/manager only.
- Roles: A, M, I (interviewer can only update their own screenings)

Body (any subset):
```json
{
  "status": "completed",
  "overall_score": 4,
  "recommendation": "yes",
  "notes": "Strong on DSA.",
  "completed_at": "2026-04-01T15:30:00Z"
}
```

### `POST /api/screenings/pipeline-snapshot`
Build and sync a denormalized pipeline snapshot for a completed screening. Called during review → submit phase to create the external API-ready snapshot.
- Roles: A, M, I (interviewer can only build snapshots for their screenings)

Body:
```json
{
  "screening_id": "scr_001",
  "overall_score": 4,
  "recommendation": "yes",
  "notes": "Strong fundamentals. Recommended for next round."
}
```

The endpoint:
1. Fetches all responses for the screening
2. Joins with code submissions (latest per question)
3. Joins with system design drawings (latest per question)
4. Builds `CandidatePipelineSnapshot` with merged question metadata
5. Upserts to `candidate_pipeline` sheet (or appends if new)

Response: `{ "success": true }`

---

## Responses (Interviewer Scores)

### `POST /api/responses`
Submit all interviewer scores for a completed screening. Called during review → submit phase.
- Roles: A, M, I (interviewer can only submit responses for their screenings)
- Validation: score must be 1-5 for each response

Body:
```json
{
  "screening_id": "scr_001",
  "responses": [
    { "question_id": "q_001", "question_type": "text", "score": 4, "notes": "Clear explanation." },
    { "question_id": "q_002", "question_type": "code", "score": 3, "notes": "Correct but O(n²)." }
  ]
}
```

Response: `{ "success": true }`

### `GET /api/responses?screening_id=scr_001`
Get all scored responses for a screening.
- Roles: A, M, I (own screenings), C (own screenings — scores hidden until completed)

Returns array of response objects with scores, notes, and timestamps.

---

## Code Submissions

### `POST /api/code-submissions`
Candidate submits code (each run creates a new row).
- Roles: C

Body:
```json
{
  "screening_id": "scr_001",
  "question_id": "q_002",
  "language": "python",
  "code": "def binary_search(arr, target):\n    ...",
  "stdout": "True",
  "stderr": "",
  "exit_code": 0
}
```

### `GET /api/code-submissions?screening_id=scr_001&question_id=q_002`
Get submissions for a question in a screening.
- A, M, I: full access — sees all submissions for any screening they can access
- C: own submissions only

Returns latest submission first.

---

## Drawings

### `POST /api/drawings`
Auto-save or manual save of Excalidraw canvas state.
- Roles: C

Body:
```json
{
  "screening_id": "scr_001",
  "question_id": "q_003",
  "excalidraw_json": "{ \"elements\": [...], \"appState\": {...} }"
}
```

### `GET /api/drawings?screening_id=scr_001&question_id=q_003`
Get the latest saved drawing for a question.
- A, M, I: any accessible screening
- C: own drawings only

Returns: `{ "excalidraw_json": "...", "submitted_at": "..." }`

---

## Code Execution

### `POST /api/execute`
Run code in a sandbox. Proxies to Piston API.
- Roles: C (during their session), A, M, I (for testing)

Body:
```json
{
  "language": "python",
  "code": "print('hello')",
  "stdin": ""
}
```

Response:
```json
{
  "stdout": "hello\n",
  "stderr": "",
  "exit_code": 0,
  "run_time_ms": 120
}
```

Supported languages defined in `src/lib/utils.ts` → `SUPPORTED_LANGUAGES`. Request with unsupported language returns 400.

Timeout: 10 seconds enforced by Piston. App route times out at 15s.

---

## Users (Admin only)

### `GET /api/users`
List all staff users.
- Roles: A

### `POST /api/users`
Create a user (admin, manager, or interviewer).
- Roles: A

Body:
```json
{ "name": "Sam K", "email": "sam@company.com", "role": "interviewer" }
```

### `PATCH /api/users/[id]`
Update user role.
- Roles: A

---

## External API (Reporting)

All routes under `/api/external/` require `Authorization: Bearer <api_key>` header instead of `cg_session`. Keys are validated against the `api_keys` tab. Each request updates `last_used_at` for audit.

### `POST /api/external/auth`
Test endpoint for external tools to validate their API key.

- Request: `{ "key": "pk_live_..." }`
- Response (200): `{ "valid": true, "scope": ["candidates", "screenings"], "expires_at": "..." }`
- Response (401): `{ "error": "Invalid key" }`

### `GET /api/external/candidates`
List all candidates with latest screening summary. No filtering.

- Requires scope: `candidates`
- Response: paginated array of candidates with `latest_screening` summary
- ISR cached 5 minutes

### `GET /api/external/candidates/[id]/pipeline`
Get complete pipeline snapshot for a candidate (all completed screenings).

- Requires scope: `candidates`
- Response: `{ candidate, pipeline_snapshots: CandidatePipelineSnapshot[] }`
- Pipeline snapshots include all question answers (text/code/design) as JSON

### `GET /api/external/screenings/[id]`
Get full screening details with all question answers, code submissions, and drawings.

- Requires scope: `screenings`
- Response: `{ screening, candidate, responses, code_submissions, drawings }`

### `GET /api/external/reports?role_id=X&status=Y&from=YYYY-MM-DD&to=YYYY-MM-DD`
Aggregated candidate reports with filtering.

- Requires scope: `reports`
- Query params (optional): `role_id`, `status` (active|hired|rejected|hold), `from`, `to`
- Response: filtered candidates + summary stats (total, avg_score, recommendation_distribution)
- ISR cached 1 hour

---

## Admin API Key Management (Admin only)

### `GET /api/admin/api-keys`
List all external API keys.
- Roles: A
- Response: array of keys (hashed_key never returned, only id + metadata)

### `POST /api/admin/api-keys`
Create a new external API key.
- Roles: A
- Body: `{ "name": "ATS Sync", "scope": ["candidates", "screenings", "reports"] }`
- Response: `{ id, name, key, scope, created_at }` — key returned only once

### `PATCH /api/admin/api-keys/[id]`
Update key metadata (name) or revoke it (set active=false).
- Roles: A
- Body: `{ "active": false }` or `{ "name": "new name" }` or both
- Response:
```json
{
  "id": "api_key_001",
  "name": "ATS Sync - Updated",
  "scope": ["candidates", "screenings"],
  "created_by": "admin_id",
  "created_at": "2026-01-15T10:00:00Z",
  "last_used_at": "2026-04-01T14:32:00Z",
  "active": true
}
```

### `DELETE /api/admin/api-keys/[id]`
Hard delete a key.
- Roles: A
- Response: 204 No Content
