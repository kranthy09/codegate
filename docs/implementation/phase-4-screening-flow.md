# Phase 4: Live Screening Flow

Two simultaneous views of the same session: the **interviewee's workspace** (`/session/[id]`) and the **interviewer's observation panel** (`/(staff)/screening/[id]`). Questions are rendered by type — text, code, or system design.

## Status: Complete

---

## Open Source Tools

### Monaco Editor — Code Questions
- Package: `@monaco-editor/react` (MIT)
- This is the same engine powering VS Code
- 40+ language syntax highlighting + IntelliSense
- `onMount` callback gives access to the editor instance for read-only mode
- Dynamic import: `const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })`
- Language support in this project: `python`, `javascript`, `typescript`, `java`, `go`, `cpp`, `rust`

### Excalidraw — System Design Questions
- Package: `@excalidraw/excalidraw` (MIT)
- Production-grade collaborative whiteboard (used at Meta scale)
- State exported as `{ elements, appState, files }` JSON
- Read-only mode via `viewModeEnabled={true}` prop
- Dynamic import: `const Excalidraw = dynamic(() => import('@excalidraw/excalidraw').then(m => m.Excalidraw), { ssr: false })`
- Auto-save: call `excalidrawAPI.getSceneElements()` on a 30s interval

### Piston — Code Execution
- Package: none — pure HTTP API call
- Self-host: github.com/engineer-man/piston (Docker, MIT)
- Public endpoint: `emkc.org/api/v2/piston` (rate-limited but usable for dev/small scale)
- API call: `POST /api/v2/execute` with `{ language, version: "*", files: [{ content: code }], stdin }`
- Our app proxies through `/api/execute` — never expose Piston URL to the client

---

## Tasks

### Interviewee Session (`/session/[id]`)
- [x] Implement `src/app/api/screenings/route.ts` — GET/POST with RBAC
- [x] Implement `src/app/api/screenings/[id]/route.ts` — GET scoped by role
- [x] Implement `src/app/api/execute/route.ts` — Piston proxy
- [x] Implement `src/app/api/code-submissions/route.ts` — POST + GET
- [x] Implement `src/app/api/drawings/route.ts` — POST + GET
- [x] Implement `src/app/session/[id]/page.tsx` — RSC shell (load screening + questions)
- [x] Implement `src/hooks/use-session.ts` — Zustand: interviewee session state
- [x] Implement `src/components/session/session-layout.tsx` — question nav + progress
- [x] Implement `src/components/session/text-question.tsx` — verbal Q&A display
- [x] Implement `src/components/session/code-question.tsx` — Monaco + run + submit
- [x] Implement `src/components/session/design-question.tsx` — Excalidraw + auto-save

### Interviewer View (`/(staff)/screening/[id]`)
- [x] Implement `src/app/(staff)/screening/[id]/page.tsx` — RSC shell
- [x] Implement `src/hooks/use-screening.ts` — Zustand: scoring state
- [x] Implement `src/components/screening/screening-layout.tsx` — two-column client wrapper
- [x] Implement `src/components/screening/session-header.tsx`
- [x] Implement `src/components/screening/question-panel.tsx` — type-aware display
- [x] Implement `src/components/screening/code-viewer.tsx` — read-only Monaco of latest submission
- [x] Implement `src/components/screening/design-viewer.tsx` — read-only Excalidraw of latest drawing
- [x] Implement `src/components/screening/score-input.tsx` — 1-5 score + notes
- [x] Implement `src/components/screening/navigation.tsx` — prev/next

---

## Key Files

```
src/app/api/screenings/route.ts
src/app/api/screenings/[id]/route.ts
src/app/api/execute/route.ts
src/app/api/code-submissions/route.ts
src/app/api/drawings/route.ts
src/app/session/[id]/page.tsx
src/app/(staff)/screening/[id]/page.tsx
src/hooks/
  use-session.ts          — interviewee Zustand store
  use-screening.ts        — interviewer Zustand store
src/components/session/
  session-layout.tsx      — "use client" main wrapper: init store, nav, renders by type
  text-question.tsx       — pure display component
  code-question.tsx       — "use client" Monaco + run + submit
  design-question.tsx     — "use client" Excalidraw + 30s auto-save
src/components/screening/
  screening-layout.tsx    — "use client" main wrapper: init store, two-column grid
  session-header.tsx      — candidate name + stage + progress indicator
  question-panel.tsx      — question text + rubric + expected_answer + ScoreInput
  code-viewer.tsx         — "use client" read-only Monaco, polls every 15s
  design-viewer.tsx       — "use client" read-only Excalidraw, polls every 30s
  score-input.tsx         — "use client" 1-5 score buttons + notes textarea
  navigation.tsx          — "use client" prev/next from useScreening store
```

---

## Architecture

### Data Flow (RSC → Client)

```
/session/[id]/page.tsx  (RSC)
  ├─ getServerUser()          — verify interviewee + ownership
  ├─ getScreeningById(id)     — get screening
  ├─ getQuestions(...)        — load questions (rubric/expected_answer stripped)
  ├─ getCandidateById(...)    — candidate name
  └─ <SessionLayout>  (client)
       ├─ useEffect → useSession.init(screeningId, questions)
       ├─ renders TextQuestion | CodeQuestion | DesignQuestion
       └─ prev/next navigation

/(staff)/screening/[id]/page.tsx  (RSC)
  ├─ getServerUser()          — verify staff + interviewer ownership check
  ├─ getScreeningById(id)
  ├─ getQuestions(...)        — full data inc. rubric (staff always sees)
  ├─ getCandidateById(...)
  ├─ getScreeningTypes()      — resolve stage name for header
  └─ <ScreeningLayout>  (client)
       ├─ useEffect → useScreening.init(screeningId, candidateName, questions)
       ├─ Left panel: QuestionPanel (question + rubric + ScoreInput)
       └─ Right panel: CodeViewer | DesignViewer | verbal-placeholder
```

### Client Component Boundaries

| Component | Why client |
|-----------|------------|
| `session-layout.tsx` | `useSession` store, event handlers |
| `code-question.tsx` | Monaco (browser-only), fetch on run/submit |
| `design-question.tsx` | Excalidraw (browser-only), auto-save interval |
| `screening-layout.tsx` | `useScreening` store, event handlers |
| `code-viewer.tsx` | Monaco read-only, polling interval |
| `design-viewer.tsx` | Excalidraw view-mode, polling interval |
| `score-input.tsx` | `useScreening` store mutations |
| `navigation.tsx` | `useScreening` store mutations |

`text-question.tsx`, `session-header.tsx`, `question-panel.tsx` are plain functions that render inside client trees — no `"use client"` needed.

### Why `excalidrawAPI` callback (not ref)
Excalidraw's dynamic import means the component type isn't known at import time.
The `excalidrawAPI={(api) => { apiRef.current = api }}` callback prop is the
type-safe way to capture the imperative API without importing internal types.

### Polling Strategy
- Code viewer: 15s — fast feedback for active DSA sessions
- Design viewer: 30s — drawings change slower; matches the interviewee auto-save interval
- Both components poll independently per question, stop on unmount via `clearInterval`

### Zustand Init Pattern
Both layout components call `store.init()` in `useEffect([screeningId, init])`.
The `questions` array is excluded from deps intentionally — it's a stable reference
created once per RSC render. The eslint-disable comment documents the choice.
Re-init fires automatically when navigating to a different screening (`screeningId` changes).

---

## Interviewee Session Layout

```
┌──────────────────────────────────────────────────────┐
│ CodeGate Interview  |  Jane Smith  |  Q 3/8  [████░] │
├──────────────────────────────────────────────────────┤
│ [TEXT Q] "Explain the event loop in Node.js"         │
│                                                      │
│  → Verbal answer — no input needed                   │
├──────────────────────────────────────────────────────┤
│ [CODE Q] "Implement two-sum with O(n) complexity"    │
│                                                      │
│  Language: [Python ▼]                                │
│ ┌──────────────────────────────────────────────────┐ │
│ │ def two_sum(nums, target):                       │ │
│ │     seen = {}                                    │ │
│ │     ...                                          │ │
│ │  (Monaco Editor)                                 │ │
│ └──────────────────────────────────────────────────┘ │
│  stdin: [optional input]     [▶ Run]  [Submit Code]  │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Output: [1, 3]                                   │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ [DESIGN Q] "Design a distributed rate limiter"       │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │                                                  │ │
│ │           (Excalidraw Canvas)                    │ │
│ │                                                  │ │
│ └──────────────────────────────────────────────────┘ │
│  Auto-saving... [Save Now]                           │
├──────────────────────────────────────────────────────┤
│  [← Prev]                             [Next →]       │
└──────────────────────────────────────────────────────┘
```

---

## Code Execution Flow

```
Interviewee clicks [▶ Run]
  │
  ▼
POST /api/execute
  { language: 'python', code: '...', stdin: '' }
  │ validates language in SUPPORTED_LANGUAGES
  ▼
POST CODE_EXECUTION_URL/api/v2/execute
  (Piston API)
  │
  ▼
{ stdout, stderr, exit_code, run.time }
  │
  ▼
Displayed in console pane below Monaco
Code is NOT submitted to sheet on Run — only on [Submit Code]
```

## Code Submit Flow

```
Interviewee clicks [Submit Code]
  │
  ▼
POST /api/code-submissions
  { screening_id, question_id, language, code, stdout, stderr, exit_code }
  │
  ▼
appendCodeSubmission() → writes row to code_submissions sheet tab
  │
  ▼
Interviewer's code-viewer.tsx polls GET /api/code-submissions?screening_id=X&question_id=Y
  every 15s, or refreshes on demand
  Shows latest submission in read-only Monaco
```

## Drawing Auto-Save Flow

```
Excalidraw onChange event (or 30s interval)
  │
  ▼
excalidrawAPI.getSceneElements() → serialize to JSON
  │
  ▼
POST /api/drawings
  { screening_id, question_id, excalidraw_json }
  │
  ▼
appendDrawing() → writes row to drawings sheet tab
  │
  ▼
Interviewer's design-viewer.tsx polls GET /api/drawings?screening_id=X&question_id=Y
  every 30s
  Loads JSON into read-only Excalidraw (viewModeEnabled={true})
```

---

## Zustand Stores

### `use-session.ts` (Interviewee)

```typescript
interface SessionStore {
  screeningId: string
  questions: Question[]
  currentIndex: number
  // Per-question code state
  code: Record<string, string>           // question_id → current code in editor
  language: Record<string, string>       // question_id → selected language
  execResult: Record<string, ExecResult> // question_id → last run result

  setCode: (qId: string, code: string) => void
  setLanguage: (qId: string, lang: string) => void
  setExecResult: (qId: string, r: ExecResult) => void
  next: () => void
  prev: () => void
}
```

### `use-screening.ts` (Interviewer)

```typescript
interface ScreeningStore {
  screeningId: string
  questions: Question[]
  currentIndex: number
  scores: Record<string, number>       // question_id → 1-5
  notes: Record<string, string>        // question_id → interviewer notes
  overallScore: number | null
  recommendation: Recommendation | null
  overallNotes: string

  setScore: (qId: string, score: number) => void
  setNotes: (qId: string, notes: string) => void
  isComplete: () => boolean
}
```

---

## Interviewer View Layout

```
┌───────────────────────────────────────────────────────────────┐
│  Screening: Jane Smith · Technical Interview · Q 2/8          │
├──────────────────────────────┬────────────────────────────────┤
│  Question                    │  Candidate Activity            │
│                              │                                │
│  "Implement two-sum"         │  [Latest Code Submission]      │
│  DSA · Binary Search         │  ┌──────────────────────────┐ │
│  medium · python             │  │ def two_sum(nums, target):│ │
│                              │  │     seen = {}            │ │
│  ─────────── Rubric ──────── │  │     ...                  │ │
│  O(n) expected, dict lookup  │  └──────────────────────────┘ │
│                              │  Output: [1, 3]  exit: 0      │
│  ─────────── Score ──────────│  Submitted: 14:32             │
│  ① ② ③ ④ ⑤             │                                │
│                              │  [Refresh ↺]                  │
│  Notes:                      │                                │
│  ┌──────────────────────┐    │                                │
│  │                      │    │                                │
│  └──────────────────────┘    │                                │
├──────────────────────────────┴────────────────────────────────┤
│  [← Prev]                                       [Next →]      │
└───────────────────────────────────────────────────────────────┘
```

For `system_design` questions, the right panel shows read-only Excalidraw with the candidate's saved drawing.

---

## Acceptance Criteria

- [x] Interviewee can write code in Monaco, run it, see output, and submit
- [x] Interviewee can draw in Excalidraw, auto-saves every 30s to sheet
- [x] Interviewer sees latest submitted code in read-only Monaco
- [x] Interviewer sees latest drawing in read-only Excalidraw
- [x] Text questions: interviewer sees question + rubric, interviewee sees question only
- [x] Piston execution returns stdout/stderr within 10s
- [x] All writes go to the correct sheet tabs
- [x] Dynamic imports prevent SSR errors for Monaco and Excalidraw
