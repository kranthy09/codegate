# Phase 3: Question Bank

Admin-managed question bank with three question types: text (Q&A), code (DSA), system_design (whiteboard). Admins create/edit via Google Sheets. The app renders them with type-aware display.

## Status: Complete

## Tasks

- [x] Implement `src/app/api/questions/route.ts` — GET with RBAC-scoped filters
- [x] Implement `src/app/(admin)/questions/page.tsx` — question list with type, role, stage, difficulty filters
- [x] Implement `src/components/questions/question-card.tsx` — type-aware card (text/code/design)
- [x] Implement `src/components/questions/question-filter.tsx` — role + type + stage + difficulty selects
- [x] Implement `src/components/questions/question-list.tsx` — renders filtered list
- [x] Roles and screening_types populated from cached Sheets calls (not internal API)
- [x] Admin/manager/interviewer see rubric + expected_answer; interviewee never sees them
- [x] ISR: questions page revalidates every 60s (`unstable_cache` with `revalidate: 60`)

## Key Files

```
src/app/api/questions/route.ts
src/app/(admin)/questions/page.tsx
src/components/questions/
  question-card.tsx      — Server Component
  question-filter.tsx    — Client Component ("use client")
  question-list.tsx      — Server Component
```

## Architecture

### Data Flow (RSC + ISR)

```
(admin)/questions/page.tsx  (RSC)
  └─ unstable_cache(getRoles + getScreeningTypes + getQuestions, revalidate: 60)
       └─ filter in-memory by searchParams (role_id, screening_type_id, type, difficulty)
            ├─ <Suspense> → QuestionFilter (client, reads/writes URL searchParams)
            └─ QuestionList → QuestionCard × N (server)
```

`unstable_cache` wraps all three Sheets calls together so one cache entry covers the full
page. Filters are applied in-memory after the cache hit — no per-filter Sheets round-trips.

### Why in-memory filtering (not per-filter `getQuestions` calls)

`getQuestions()` already filters in JS after a full sheet fetch. Wrapping it per-filter-combo
in `unstable_cache` would create O(n) cache entries for different URL combos. Fetching once
and filtering in the RSC keeps the cache simple: one entry, 60s TTL.

## Question Types in the Bank

### Text Question Card
Displays: question text, category badge, difficulty badge (color-coded).
Expandable (`<details>`): rubric, expected answer — staff only.

### Code Question Card
Displays: question text, language badge, difficulty badge.
Code preview: `<pre>` block with first 8 lines of `starter_code` (dark theme, monospace).
**No Monaco** — avoids SSR issues; Monaco is reserved for the live coding session.
Expandable: full rubric + expected answer — staff only.

### System Design Card
Displays: design brief text, difficulty badge, category tag.
No starter code — the Excalidraw canvas is the answer space.
Expandable: design rubric — staff only.

## Filter URL Params (search-param driven, no client state)

```
/questions?role_id=role_001&screening_type_id=st_003&type=code&difficulty=hard
```

Page is an RSC — `searchParams` are `await`-ed props → passed to `filterQuestions()`.
`QuestionFilter` (`"use client"`) reads from `useSearchParams()` and pushes to router on `onChange`.

## RBAC

### API Route (`/api/questions`)
```typescript
// Interviewee: override filters from session token claims
if (user.role === 'interviewee') {
  filters = { role_id: user.role_id, screening_type_id: user.screening_type_id, difficulty: user.difficulty, type: filters.type }
}
// Strip sensitive fields from interviewee response
if (user.role === 'interviewee') {
  questions = questions.map(({ rubric: _r, expected_answer: _e, ...q }) => ({ ...q, rubric: null, expected_answer: null }))
}
```

### Page-level (`showSensitive` prop)
`showSensitive = user?.role !== 'interviewee'` — controls whether QuestionCard renders the
`<details>` block with rubric + expected answer. Admin questions page is behind `(admin)/layout.tsx`
so `showSensitive` is always `true` there; the prop remains for component reuse in other contexts.

## Suspense Boundary

`QuestionFilter` uses `useSearchParams()` which requires a `<Suspense>` boundary in Next.js 15.
The fallback renders four animated skeleton pills matching the filter row dimensions.

```tsx
<Suspense fallback={<FilterSkeleton />}>
  <QuestionFilter roles={roles} screeningTypes={screeningTypes} />
</Suspense>
```

## Acceptance Criteria

- [x] Questions load from sheet with 60s ISR via `unstable_cache`
- [x] `?type=code` returns only code questions
- [x] `?type=system_design` returns only system design questions
- [x] Admin/manager/interviewer see rubric and expected_answer (`showSensitive=true`)
- [x] Interviewee API response strips rubric and expected_answer
- [x] Interviewee API query is automatically scoped to their token claims
- [x] Empty state shown when no questions match filters
- [x] `npm run build` succeeds — no SSR issues (Monaco not used in card preview)
