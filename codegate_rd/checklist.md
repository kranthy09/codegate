# CodeGate — Build Checklist

Each task is independently testable before moving on. Complete in order within each phase.

---

## Phase 1 — Shell & Design System (Day 1)

### 1.1 Scaffold
- [ ] Run `npm create vite@latest codegate -- --template react-ts`
- [ ] Install deps: `tailwindcss @tailwindcss/vite react-router-dom`
- [ ] Install fonts: `@fontsource/fraunces @fontsource/dm-sans @fontsource/jetbrains-mono`
- [ ] Install deploy: `gh-pages --save-dev`
- [ ] Configure `vite.config.ts` — set `base: '/codegate/'`
- [ ] Add `predeploy` + `deploy` scripts to `package.json`
- [ ] Create `.env.example` with `VITE_INTERVIEWER_PIN` and `VITE_SOLUTION_B64`
- [ ] Create `.env` (gitignored) with real PIN + base64 solution
- [ ] Verify `npm run dev` starts without errors

### 1.2 Design Tokens
- [ ] Import all three fonts in `src/index.css`
- [ ] Define CSS custom properties: `--color-surface`, `--color-panel`, `--color-border`, `--color-accent`, `--color-danger`, `--color-warning`, `--radius-md`, `--shadow-card`
- [ ] Apply font families via Tailwind config or CSS: Fraunces → headings, DM Sans → body, JetBrains Mono → `font-mono`
- [ ] Visual check: open browser, confirm fonts are loading

### 1.3 AppShell Component
- [ ] Create `src/components/AppShell.tsx`
- [ ] Header bar: logo text "CodeGate", session name slot, right-side status slot
- [ ] Main area: two-column CSS grid (40/60 split) with named areas `problem` and `editor`
- [ ] Bottom status strip: placeholder slots for line count, word count, autosave badge
- [ ] Responsive: single column stack on screens < 1024px
- [ ] Visual check: renders correctly at desktop and mobile widths

### 1.4 StatusBar Component
- [ ] Create `src/components/StatusBar.tsx`
- [ ] Props: `status: 'idle' | 'active' | 'submitted'`
- [ ] Renders styled pill — grey/green/blue based on status
- [ ] Visual check: render all three states in isolation (Storybook or inline test page)

### 1.5 Routing
- [ ] Create `src/router.tsx` using `createHashRouter`
- [ ] Add three routes: `/`, `/session`, `/review`
- [ ] Create stub page components: `Lobby.tsx`, `Session.tsx`, `Review.tsx` (each just renders its name)
- [ ] Wrap app in `RouterProvider` in `main.tsx`
- [ ] Add route fade transition using `useLocation` + CSS opacity
- [ ] Verify: navigate manually to `/#/`, `/#/session`, `/#/review` — all render

---

## Phase 2 — Candidate Session Experience (Day 2)

### 2.1 Problem Config
- [ ] Create `src/config/problem.ts` — export problem object: `{ title, description, starterCode, hints[] }`
- [ ] Fill in a real problem (e.g., debug an async Express handler)
- [ ] Verify: import in browser console — no solution present in object

### 2.2 Timer Hook
- [ ] Create `src/hooks/useTimer.ts`
- [ ] Input: `durationMinutes: number`
- [ ] Output: `{ remaining: number, isExpired: boolean }` (remaining in seconds)
- [ ] Use `setInterval` via `useRef`, clear on unmount
- [ ] Persist `startedAt` to `sessionStorage` — restores on page refresh
- [ ] Unit test (manual): set 1-minute timer, refresh page mid-countdown, confirm it resumes correctly

### 2.3 SessionTimer Component
- [ ] Create `src/components/SessionTimer.tsx`
- [ ] Props: `durationMinutes: number`, `onExpire: () => void`
- [ ] Display: `MM:SS` in JetBrains Mono
- [ ] Color changes: amber at ≤ 5min, red at ≤ 2min
- [ ] Pulse animation at ≤ 2min (CSS keyframe)
- [ ] Calls `onExpire` once when `isExpired` becomes true
- [ ] Visual check: fast-forward timer by setting a short duration

### 2.4 ProblemCard Component
- [ ] Create `src/components/ProblemCard.tsx`
- [ ] Renders problem title (Fraunces h1)
- [ ] Renders description (DM Sans body)
- [ ] Section anchors: Context, Broken Code, Your Task, Hints
- [ ] Hints section: collapsible accordion (closed by default)
- [ ] Read-only Monaco instance for `starterCode` display
- [ ] Visual check: all sections render and accordion toggles

### 2.5 Session Hook
- [ ] Create `src/hooks/useSession.ts`
- [ ] State: `code`, `isSubmitted`, `submittedAt`, `lineCount`, `wordCount`
- [ ] Load initial code from `sessionStorage` if key exists
- [ ] Debounced auto-save to `sessionStorage` every 30s
- [ ] `submit()`: sets `isSubmitted`, records `submittedAt`, clears draft from `sessionStorage`

### 2.6 Code Editor Component
- [ ] Install `@monaco-editor/react`
- [ ] Create `src/components/CodeEditor.tsx`
- [ ] Props: `value`, `onChange`, `readOnly`, `onStatsChange` (lineCount, wordCount)
- [ ] Configure editor options: `fontSize 14`, `lineHeight 1.75`, `minimap off`, `scrollBeyondLastLine false`
- [ ] Create and register a custom light Monaco theme (white background)
- [ ] Wire auto-save via `useSession`
- [ ] `readOnly` prop locks editor (used after submit or timer expiry)
- [ ] Visual check: type code, refresh, confirm code is restored

### 2.7 Submission Flow
- [ ] Wire `Submit` button in `Session.tsx`
- [ ] Disable button when `lineCount < 20`, show tooltip
- [ ] On submit: call `useSession().submit()`, editor switches to `readOnly`
- [ ] Render confirmation overlay: time taken, lines written, status message
- [ ] Block back navigation before submit with `beforeunload` warning
- [ ] Clear `beforeunload` warning after submit
- [ ] Visual check: submit with < 20 lines (blocked), with ≥ 20 lines (success overlay)

### 2.8 Wire Session Page
- [ ] `Session.tsx` composes: `AppShell` + `ProblemCard` + `SessionTimer` + `CodeEditor`
- [ ] `StatusBar` state flows from `useSession` (`idle` → `active` → `submitted`)
- [ ] Status strip shows live `lineCount`, `wordCount`, autosave timestamp
- [ ] Timer expiry → locks editor, shows "Time's up" overlay
- [ ] End-to-end check: full candidate flow from lobby to submission

---

## Phase 3 — Execution Sandbox & Interviewer Review (Day 3)

### 3.1 Execution Runner
- [ ] Create `src/sandbox/runner.ts`
- [ ] Capture `console.log` output into array before execution, restore after
- [ ] Define mock environment: `mockExpress`, `mockApp`, `mockGetUserById`
- [ ] Run code via `new Function('express', 'app', 'getUserById', code)(mockExpress, mockApp, mockGetUserById)`
- [ ] Wrap in try/catch — capture runtime errors
- [ ] Implement 3s timeout: `setTimeout` that rejects a promise race
- [ ] Override `fetch` and `XMLHttpRequest` to throw inside sandbox scope
- [ ] Manual test: run correct code (output visible), run broken code (error shown), run infinite loop (timeout fires)

### 3.2 OutputTerminal Component
- [ ] Create `src/components/OutputTerminal.tsx`
- [ ] Props: `lines: string[]`, `error: string | null`
- [ ] Scrollable read-only pane, JetBrains Mono 13px
- [ ] Normal output: default text color
- [ ] Error output: `--color-danger` red
- [ ] "Run" button: calls `runCode(currentCode)`, populates lines/error
- [ ] "Clear" button: resets state
- [ ] Wire into `Session.tsx` below `CodeEditor`

### 3.3 PIN Gate
- [ ] In `Review.tsx`: render centered PIN input modal on mount
- [ ] PIN input: 6-digit numeric, masked
- [ ] On submit: compare against `import.meta.env.VITE_INTERVIEWER_PIN`
- [ ] Correct: dismiss modal, render `ReviewPanel`
- [ ] Incorrect: shake animation, decrement attempt counter
- [ ] 3 failed attempts: 60s lockout with countdown, inputs disabled
- [ ] Manual test: correct PIN unlocks, wrong PIN shows error + lockout

### 3.4 ReviewPanel Component
- [ ] Create `src/components/ReviewPanel.tsx`
- [ ] Section 1 — Metadata: submittedAt, time taken, line count
- [ ] Section 2 — Submitted code: read-only Monaco
- [ ] Section 3 — Rubric: 5 checkboxes with labels and per-criterion notes textarea
- [ ] Section 4 — Live score: `(checked / 5) * 100`, displayed as percentage + progress bar
- [ ] Section 5 — Feedback textarea: interviewer free-form notes
- [ ] Section 6 — "Reveal Solution" button (initially hidden)

### 3.5 Solution Reveal
- [ ] "Reveal Solution" click: call `atob(import.meta.env.VITE_SOLUTION_B64)` → solution string
- [ ] Render side-by-side view: candidate code (left) | solution (right)
- [ ] Implement line-by-line diff: compute added/removed lines manually
- [ ] Highlight diff: green background for solution-only lines, red for candidate-only lines
- [ ] Confirm solution is NOT present in DOM before button is clicked (browser DevTools check)

### 3.6 Deploy
- [ ] Verify `npm run build` completes without errors
- [ ] Inspect `dist/` — confirm no solution text present in any `.js` file (`grep -r SOLUTION dist/`)
- [ ] Run `npm run deploy` — confirm push to `gh-pages` branch succeeds
- [ ] Open live GitHub Pages URL — verify all three routes work
- [ ] Set env vars in Vercel dashboard (if using Vercel), redeploy, re-verify
- [ ] Create `vercel.json` with rewrite rule
- [ ] Write `README.md` — interviewer setup in ≤ 10 steps

---

## Final Verification

- [ ] Candidate flow: lobby → session → write code → submit → confirmation
- [ ] Timer: counts down, color changes, locks editor at 0
- [ ] Auto-save: write code, refresh page, code restored
- [ ] Code execution: run valid code (output shows), run invalid code (error shows), run slow code (timeout fires)
- [ ] Review flow: navigate to `/#/review`, wrong PIN rejected, correct PIN accepted
- [ ] Solution security: open DevTools → Network, Sources, Console → no solution visible before PIN + Reveal
- [ ] Deploy: live URL accessible, env vars set, solution not in bundle
