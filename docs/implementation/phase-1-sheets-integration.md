# Phase 1: Google Sheets Integration

Build the full data layer — authenticated Sheets client, typed query functions, mutation functions for all 11 tabs (roles, screening_types, questions, candidates, screenings, responses, code_submissions, drawings, users, candidate_pipeline, api_keys). Google Sheets is the single source of truth. All other phases depend on this.

## Tasks

- [ ] Implement `src/lib/sheets/client.ts` — googleapis client + RANGES for 11 tabs
- [ ] Implement row mappers for all 11 tabs inside `queries.ts`
- [ ] Add answer interfaces to `src/types/index.ts`:
  - `TextAnswer`, `CodeAnswer`, `SystemDesignAnswer`
  - `InterviewAnswer` (union type)
  - `CandidatePipelineSnapshot`
  - `ApiKey`
- [ ] Implement `src/lib/sheets/queries.ts`:
  - `getRoles()`
  - `getScreeningTypes()`
  - `getQuestions(filters?)` — accepts `role_id`, `screening_type_id`, `difficulty`, `type`
  - `getCandidates()`
  - `getCandidateById(id)`
  - `getScreenings(caller)` — scoped by role
  - `getScreeningById(id)`
  - `getResponsesByScreeningId(id)`
  - `getCodeSubmissions(screening_id, question_id?, caller?)` — latest first
  - `getLatestDrawing(screening_id, question_id, caller?)` — single latest
  - `getUserByEmail(email)` — staff lookup
  - `getCandidateByEmail(email)`
  - `getCandidatePipelineSnapshot(candidate_id)` — all completed screenings
  - `getApiKeyByHash(hashed)` — validate external API key
  - `listApiKeys(created_by?)` — admin lookup
- [ ] Implement `src/lib/sheets/mutations.ts`:
  - `createCandidate(data)`
  - `createScreening(data, interviewer_id)`
  - `updateScreening(id, data)` — status, scores, recommendation, completed_at
  - `appendResponses(payload)`
  - `appendCodeSubmission(payload)`
  - `appendDrawing(payload)`
  - `createUser(data)`
  - `updateUser(id, role)`
  - `syncCandidatePipelineSnapshot(snapshot)` — atomic write to candidate_pipeline tab
  - `createApiKey(data)` — admin only
  - `updateApiKeyLastUsed(key_id)` — audit trail
  - `revokeApiKey(key_id)` — set active=FALSE
- [ ] Implement `src/app/api/roles/route.ts`
- [ ] Implement `src/app/api/screening-types/route.ts`
- [ ] Test all queries and mutations against real sheet in dev

## Key Files

```
src/lib/sheets/
  client.ts         — auth + RANGES
  queries.ts        — all read operations
  mutations.ts      — all write operations
src/app/api/
  roles/route.ts
  screening-types/route.ts
```

## Data Conventions

- All sheet rows are read as `string[][]` — always parse with mapper functions
- IDs: `crypto.randomUUID()` generated before writing
- Booleans: stored as `"TRUE"` / `"FALSE"` strings — `row[n] === 'TRUE'`
- Dates: ISO 8601 strings
- Empty cells: normalize to `null` or `""` in mappers — never leave as `undefined`
- `code` in code_submissions: stored as-is (no encoding needed for Sheets)

## Updated Row Mapper: Question

```typescript
function rowToQuestion(row: string[]): Question {
  return {
    id: row[0],
    role_id: row[1],
    screening_type_id: row[2],
    type: (row[3] as Question['type']) ?? 'text',
    text: row[4],
    difficulty: (row[5] as Question['difficulty']) ?? 'medium',
    category: row[6] ?? '',
    rubric: row[7] || null,
    expected_answer: row[8] || null,
    starter_code: row[9] || null,
    language: row[10] || null,
    active: row[11] === 'TRUE',
  }
}
```

## New Row Mappers

```typescript
function rowToCodeSubmission(row: string[]): CodeSubmission {
  return {
    id: row[0],
    screening_id: row[1],
    question_id: row[2],
    candidate_id: row[3],
    language: row[4],
    code: row[5],
    stdout: row[6] ?? '',
    stderr: row[7] ?? '',
    exit_code: Number(row[8] ?? 0),
    submitted_at: row[9],
  }
}

function rowToDrawing(row: string[]): Drawing {
  return {
    id: row[0],
    screening_id: row[1],
    question_id: row[2],
    candidate_id: row[3],
    excalidraw_json: row[4],
    submitted_at: row[5],
  }
}

function rowToCandidatePipelineSnapshot(row: string[]): CandidatePipelineSnapshot {
  return {
    id: row[0],
    candidate_id: row[1],
    screening_id: row[2],
    role_id: row[3],
    screening_type_id: row[4],
    status: (row[5] as 'completed' | 'in_progress') ?? 'in_progress',
    overall_score: row[6] ? Number(row[6]) : null,
    recommendation: row[7] || null,
    responses_json: row[8] ? JSON.parse(row[8]) : [],
    code_submissions_json: row[9] ? JSON.parse(row[9]) : [],
    drawings_json: row[10] ? JSON.parse(row[10]) : [],
    interviewer_notes: row[11] || null,
    created_at: row[12],
    completed_at: row[13] || null,
  }
}

function rowToApiKey(row: string[]): ApiKey {
  return {
    id: row[0],
    name: row[1],
    hashed_key: row[2],
    scope: (row[3] ?? '').split(',').filter(Boolean),
    created_by: row[4],
    created_at: row[5],
    last_used_at: row[6] || null,
    active: row[7] === 'TRUE',
  }
}

// Answer builders for pipeline snapshots
function buildTextAnswer(response: Response, question: Question): TextAnswer {
  return {
    question_id: response.question_id,
    question_type: 'text',
    question_text: question.text,
    score: response.score,
    notes: response.notes,
    submitted_at: response.submitted_at,
  }
}

function buildCodeAnswer(
  response: Response,
  question: Question,
  submission: CodeSubmission,
): CodeAnswer {
  return {
    question_id: response.question_id,
    question_type: 'code',
    question_text: question.text,
    language: submission.language,
    code: submission.code,
    stdout: submission.stdout,
    stderr: submission.stderr,
    exit_code: submission.exit_code,
    score: response.score,
    notes: response.notes,
    submitted_at: submission.submitted_at,
  }
}

function buildSystemDesignAnswer(
  response: Response,
  question: Question,
  drawing: Drawing,
): SystemDesignAnswer {
  return {
    question_id: response.question_id,
    question_type: 'system_design',
    question_text: question.text,
    excalidraw_json: drawing.excalidraw_json,
    score: response.score,
    notes: response.notes,
    submitted_at: drawing.submitted_at,
  }
}
```

## Scoped Query Pattern (RBAC)

Queries receive a `caller` parameter that limits results based on role:

```typescript
export async function getScreenings(caller: SessionUser): Promise<Screening[]> {
  const all = await fetchAllScreenings()
  if (caller.role === 'admin' || caller.role === 'manager') return all
  if (caller.role === 'interviewer') return all.filter(s => s.interviewer_id === caller.id)
  if (caller.role === 'interviewee') return all.filter(s => s.candidate_id === caller.id)
  return []
}
```

This pattern is applied in `getScreenings`, `getCodeSubmissions`, `getLatestDrawing`, `getResponsesByScreeningId`.

## Acceptance Criteria

- All 9 tabs have corresponding read functions
- `getQuestions({ type: 'code', role_id: 'x' })` returns only code questions for that role
- `appendCodeSubmission(...)` writes to `code_submissions` tab visible in sheet
- `appendDrawing(...)` writes to `drawings` tab
- Scoped queries return only authorized data based on caller role
- No raw `any` types
