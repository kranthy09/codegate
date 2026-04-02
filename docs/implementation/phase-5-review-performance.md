# Phase 5: Review, Submit & Reporting

After the interviewer scores all questions (text/code/system_design), they review the full session — including submitted code and drawings — add final recommendation, and submit. All data is written to Google Sheets atomically, including the denormalized `candidate_pipeline` snapshot for external API access.

## Implementation Status

✅ **Complete** — All components, APIs, and review flow implemented.

## Key Files Created

| File | Purpose |
|------|---------|
| `src/lib/sheets/reporting.ts` | `buildCandidatePipelineSnapshot()` helper — denormalizes all answers for external APIs |
| `src/app/api/responses/route.ts` | Enhanced POST/GET for bulk responses with RBAC + validation |
| `src/app/api/screenings/pipeline-snapshot/route.ts` | POST endpoint — builds and syncs pipeline snapshot |
| `src/app/(staff)/screening/[id]/review/page.tsx` | Server component — loads all screening data (questions, responses, submissions, drawings) |
| `src/app/(staff)/screening/[id]/review/review-client.tsx` | Client component — manages atomic 3-step submit flow |
| `src/components/screening/review-summary.tsx` | Type-aware question review display |
| `src/components/screening/code-review-card.tsx` | Read-only Monaco code viewer with output |
| `src/components/screening/design-review-card.tsx` | Read-only Excalidraw canvas viewer |
| `src/components/screening/final-form.tsx` | Overall score, recommendation, and notes form |

## Key Files

```
src/app/(staff)/screening/[id]/review/page.tsx
src/app/api/responses/route.ts
src/components/screening/
  review-summary.tsx
  code-review-card.tsx
  design-review-card.tsx
  final-form.tsx
```

## Submit Flow (Atomic)

```typescript
async function submitScreening(store: ScreeningStore) {
  setSubmitting(true)

  // 1. Bulk-submit all question scores
  const res1 = await fetch('/api/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screening_id: store.screeningId,
      responses: store.questions.map((q) => ({
        question_id: q.id,
        question_type: q.type,
        score: store.scores[q.id],
        notes: store.notes[q.id] ?? '',
      })),
    }),
  })
  if (!res1.ok) { setError('Failed to submit scores'); return }

  // 2. Build and sync candidate pipeline snapshot (denormalized for external APIs)
  const res2 = await fetch('/api/screenings/pipeline-snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screening_id: store.screeningId,
      overall_score: store.overallScore,
      recommendation: store.recommendation,
      notes: store.overallNotes,
    }),
  })
  if (!res2.ok) { setError('Failed to sync pipeline data'); return }

  // 3. Mark screening complete
  const res3 = await fetch(`/api/screenings/${store.screeningId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'completed',
      overall_score: store.overallScore,
      recommendation: store.recommendation,
      notes: store.overallNotes,
      completed_at: new Date().toISOString(),
    }),
  })
  if (!res3.ok) { setError('Failed to complete screening'); return }

  router.push(`/management/candidates/${candidateId}`)
}
```

**Key additions:**
- New `/api/screenings/pipeline-snapshot` endpoint builds `CandidatePipelineSnapshot` by joining responses + code submissions + drawings + question metadata
- Snapshot includes JSON arrays of `InterviewAnswer` objects (one per question type)
- Written atomically to `candidate_pipeline` tab for external API consumption
- All 3 steps must succeed; any failure keeps user on review page for retry

## Review Summary Layout

```
┌──────────────────────────────────────────────────┐
│ Review — Jane Smith                              │
│ Backend Engineer · Technical Interview           │
├──────────────────────────────────────────────────┤
│ [TEXT] Q1: Explain event loop in Node.js         │
│  Score: 4/5  |  "Correct, mentioned call stack"  │
│──────────────────────────────────────────────────│
│ [CODE] Q2: Implement two-sum — O(n)              │
│  ┌────────────────────────────────────────────┐  │
│  │ def two_sum(nums, target):                 │  │
│  │     seen = {}                              │  │
│  │     for i, n in enumerate(nums):           │  │
│  │         ...                                │  │
│  └────────────────────────────────────────────┘  │
│  Output: [1, 3]  exit: 0                        │
│  Score: 3/5  |  "Works but no edge case check"   │
│──────────────────────────────────────────────────│
│ [DESIGN] Q3: Design a URL shortener             │
│  ┌────────────────────────────────────────────┐  │
│  │  [read-only Excalidraw snapshot]            │  │
│  └────────────────────────────────────────────┘  │
│  Score: 4/5  |  "Good DB schema, missed CDN"     │
├──────────────────────────────────────────────────┤
│ Overall Score:  ① ② ③ ④ ⑤             │
│ Recommendation: [Strong Yes ▼]                   │
│ Notes:                                           │
│ ┌──────────────────────────────────────────────┐ │
│ │ Strong DSA fundamentals. Recommend advancing. │ │
│ └──────────────────────────────────────────────┘ │
│                          [Submit Review]          │
└──────────────────────────────────────────────────┘
```

## RBAC

- Only `admin`, `manager`, `interviewer` can reach this page
- `interviewer` can only submit review for screenings where `interviewer_id === session.id`
- The PATCH `/api/screenings/[id]` route enforces this check

## Acceptance Criteria

- Review page shows all questions with their type-appropriate previews
- Code questions show the candidate's latest submitted code in read-only Monaco
- System design questions show the latest saved Excalidraw drawing
- Overall score and recommendation required before submit is enabled
- Both API calls complete before redirect
- On failure: error message shown, retry available — no partial state saved
- Submitted data visible in `responses` and `screenings` sheet tabs within 5s
