# CodeGate — Features Reference

## F1 — Project Shell & Design System

### F1.1 — Vite + React + TypeScript Scaffold

**Goal:** Runnable dev server with correct deploy config.

**Steps:**
```bash
npm create vite@latest codegate -- --template react-ts
cd codegate
npm install tailwindcss @tailwindcss/vite
npm install @fontsource/fraunces @fontsource/dm-sans @fontsource/jetbrains-mono
npm install react-router-dom
npm install gh-pages --save-dev
```

**Config — `vite.config.ts`:**
```ts
export default defineConfig({
  base: '/codegate/',
  plugins: [react()],
})
```

**Config — `package.json` scripts:**
```json
"predeploy": "npm run build",
"deploy": "gh-pages -d dist"
```

**`.env.example`:**
```
VITE_INTERVIEWER_PIN=123456
VITE_SOLUTION_B64=
```

---

### F1.2 — Design Tokens & Layout Shell

**Goal:** All CSS tokens defined once; layout frame renders in browser.

**Deliverables:**
- `src/index.css` — CSS custom properties for all design tokens
- `AppShell.tsx` — top-level layout: header + split pane area + bottom status strip
- `StatusBar.tsx` — pill component showing `idle | active | submitted` with appropriate colors

**AppShell layout spec:**
```
┌─────────────────────────────────────┐
│  HEADER  [Logo]  [Session]  [Status]│
├──────────────────┬──────────────────┤
│  Problem Pane    │  Editor Pane     │
│  (40%)           │  (60%)           │
│                  │                  │
├──────────────────┴──────────────────┤
│  STATUS STRIP  [lines] [words] [💾] │
└─────────────────────────────────────┘
```

**StatusBar states:**
- `idle` — grey pill, "No active session"
- `active` — green pill, "Session in progress"
- `submitted` — blue pill, "Submitted — awaiting review"

---

### F1.3 — Navigation & Routing

**Goal:** All three routes resolve correctly on GitHub Pages.

**Deliverables:**
- `src/router.tsx` — `createHashRouter` with three routes
- Route-level lazy loading with `React.lazy` + `Suspense`
- Page transition: CSS opacity fade (200ms) using React Router `useLocation`

**Route table:**

| Path | Component | Guard |
|---|---|---|
| `/` | `Lobby.tsx` | None |
| `/session` | `Session.tsx` | None |
| `/review` | `Review.tsx` | PIN modal blocks render |

---

## F2 — Candidate Session Experience

### F2.1 — Problem Panel & Timer

**Goal:** Candidate sees problem clearly; knows how much time remains.

**`ProblemCard.tsx` spec:**
- Renders: problem title (h1, Fraunces), context description, broken starter code (read-only Monaco instance)
- Sticky scroll with anchor links to sections: Context → Broken Code → Your Task → Hints
- Hints section: collapsible accordion, collapsed by default

**`SessionTimer.tsx` spec:**
- Props: `durationMinutes: number`, `onExpire: () => void`
- Display: `MM:SS` in JetBrains Mono, large
- Color transitions:
  - Default: `--color-surface` text
  - ≤ 5 min remaining: amber (`--color-warning`)
  - ≤ 2 min remaining: red (`--color-danger`), subtle pulse animation
  - 0:00: fires `onExpire`, editor locks

**`useTimer.ts` hook:**
```ts
const { remaining, isExpired } = useTimer(durationMinutes)
```
- Uses `useRef` for interval, cleans up on unmount
- Persists `startedAt` to `sessionStorage` so page refresh doesn't reset timer

---

### F2.2 — Code Editor

**Goal:** Comfortable writing environment with auto-save.

```bash
npm install @monaco-editor/react
```

**`CodeEditor.tsx` spec:**
- Language: `javascript`
- Theme: custom light theme (white background, muted token colors — not VS Code Dark)
- Editor options:
  ```ts
  {
    fontSize: 14,
    lineHeight: 1.75,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    readOnly: false,  // becomes true after submit or timer expiry
  }
  ```
- Auto-save: debounced write to `sessionStorage` every 30s
- Status bar integration: emits `lineCount` and `wordCount` via callback prop

**`useSession.ts` hook:**
```ts
const { code, setCode, submit, isSubmitted, lineCount, wordCount } = useSession()
```
- Loads initial code from `sessionStorage` if present (handles refresh)
- `submit()`: freezes state, records `submittedAt`, clears draft from `sessionStorage`

---

### F2.3 — Submission Flow

**Goal:** Clear, irreversible submission with confirmation.

**Submit button rules:**
- Disabled until editor has ≥ 20 lines of code
- Tooltip on hover when disabled: "Write at least 20 lines to submit"

**On submit:**
1. Editor becomes `readOnly: true`
2. `submittedAt` timestamp recorded to `sessionStorage`
3. Confirmation overlay renders over the editor pane:
   - Time taken (formatted: `Xm Ys`)
   - Lines written
   - "Your solution has been submitted. Awaiting interviewer review."
4. Draft code cleared from `sessionStorage`
5. Back navigation blocked (`useBeforeUnload` warning cleared after submit)

---

## F3 — Execution Sandbox & Interviewer Review

### F3.1 — Bounded Code Execution

**Goal:** Run candidate code safely in-browser with visible output.

**`sandbox/runner.ts` spec:**

```ts
export function runCode(code: string): { output: string[]; error: string | null }
```

**Execution harness:**
- Overrides `console.log` to capture output lines
- Injects mock environment before `new Function()` call:
  ```ts
  const mockExpress = () => ({ get: () => {}, listen: () => {} })
  const mockGetUserById = (id) => ({ id, name: 'Test User', email: 'test@example.com' })
  ```
- Wraps execution in try/catch — runtime errors captured as `error`
- Hard timeout: `setTimeout(() => { throw new Error('Execution timeout') }, 3000)`
- Blocks network: overrides `fetch` and `XMLHttpRequest` to throw immediately

**`OutputTerminal.tsx` spec:**
- Read-only scrollable pane
- Renders output lines in JetBrains Mono, 13px
- Error output: red text
- "Run" button triggers `runCode(currentCode)` and populates terminal
- "Clear" button resets output

---

### F3.2 — Interviewer Review Panel (PIN-Gated)

**Goal:** Interviewer sees submission, scores it, and optionally reveals solution.

**PIN gate (`Review.tsx`):**
- On mount, renders a centered PIN input modal — no other content visible
- On correct PIN (`import.meta.env.VITE_INTERVIEWER_PIN`): modal dismisses, panel renders
- On incorrect PIN: shake animation, error message, 3-attempt lockout (60s cooldown)

**`ReviewPanel.tsx` spec:**

Sections (in order):
1. **Submission metadata** — candidate name (if collected), `submittedAt`, time taken, line count
2. **Submitted code** — read-only Monaco, same config as candidate editor
3. **Rubric checklist** — 5 criteria, each with checkbox + label + optional notes field:
   - Identifies the core bug
   - Implements correct async/await
   - Handles error case
   - Code is readable / well-structured
   - Edge cases considered
4. **Live score** — computed from checked criteria (`score = checked / 5 * 100`)
5. **Feedback notes** — free-text textarea for interviewer comments
6. **"Reveal Solution" button** — decodes `VITE_SOLUTION_B64` via `atob()`, renders side-by-side diff

**Side-by-side diff view:**
- Left: candidate's submitted code
- Right: canonical solution (decoded)
- Diff highlighting: added lines green, removed lines red (manual line diff, no external diff library needed for MVP)

---

### F3.3 — Deploy & Hosting

**Goal:** Interviewer can spin up a live session in < 5 minutes.

**GitHub Pages deploy:**
```bash
npm run deploy
```
- Pre-deploy: `npm run build`
- Pushes `dist/` to `gh-pages` branch
- Live at: `https://<username>.github.io/codegate/`

**Vercel deploy (`vercel.json`):**
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Environment variable setup (Vercel):**
- `VITE_INTERVIEWER_PIN` → set in Vercel dashboard → Environment Variables
- `VITE_SOLUTION_B64` → `btoa(solutionCodeString)` → set same way
- Both are scoped to Production only

**Interviewer setup checklist (README):**
1. Fork repo
2. Set env vars in Vercel/GitHub secrets
3. `npm run deploy` or push to trigger Vercel build
4. Share `/` URL with candidate
5. After session, navigate to `/#/review` with PIN
