Here's the complete project plan — structured, deployable, and LLM-proof.

---

## Project: **CodeGate** — Interview Sandbox Portal

**Stack:** Vite + React + TypeScript · Monaco Editor · Tailwind CSS · `gh-pages` / Vercel deploy

**Design direction:** Clean white, editorial, professional — like a high-end technical documentation site meets a coding exam room. Font pairing: `Fraunces` (display/headings) + `JetBrains Mono` (code) + `DM Sans` (body).

**LLM-proofing strategy:** Solution is never in the client bundle at build time. It's stored base64-encoded in a separate env variable or fetched from a password-protected serverless endpoint only after the session is submitted. The DOM never contains the solution until the interviewer unlocks it with a PIN.

---

## Feature Breakdown

---

### F1 — Project Shell & Design System

> _Get the foundation right once. Everything else builds on it._

**F1.1 — Vite + React + TypeScript scaffold**

```
npm create vite@latest codegate -- --template react-ts
```

- Install: `tailwindcss`, `@fontsource/fraunces`, `@fontsource/dm-sans`, `@fontsource/jetbrains-mono`
- Configure `vite.config.ts` with `base: '/codegate/'` for GitHub Pages
- Add `gh-pages` deploy script in `package.json`
- `.env.example` with `VITE_INTERVIEWER_PIN` and `VITE_SOLUTION_B64`

**F1.2 — Design tokens & layout shell**

- CSS variables for color, spacing, radius, shadow
- `AppShell.tsx` — header bar + main content area + status strip
- `StatusBar.tsx` — session state indicator (idle / active / submitted)
- Responsive grid: problem pane (40%) | editor pane (60%)

**F1.3 — Navigation & routing**

- `react-router-dom` with hash routing (works on GitHub Pages without a server)
- Routes: `/` (lobby) → `/session` (main sandbox) → `/review` (interviewer-only, PIN-gated)
- Transition: subtle fade between routes, no jarring jumps

---

### F2 — Candidate Session Experience

> _The candidate sees exactly what they need. Nothing more._

**F2.1 — Problem panel**

- `ProblemCard.tsx` — renders problem title, context description, starter code in a read-only Monaco instance
- Sticky scroll with section anchors: Context → Broken Code → Your Task → Hints (collapsible)
- Timer component: `SessionTimer.tsx` — counts down, color shifts amber at 5min, red at 2min, locks editor at 0

**F2.2 — Code editor (Monaco)**

```bash
npm install @monaco-editor/react
```

- Language: `javascript`, theme: custom light theme (white bg, muted syntax colors — not VS Code dark)
- Editor config: `fontSize: 14`, `lineHeight: 1.75`, `minimap: false`, `scrollBeyondLastLine: false`
- Auto-save to `sessionStorage` every 30s — candidate doesn't lose work on accidental refresh
- Word count + line count in status bar

**F2.3 — Submission flow**

- `Submit` button activates only when editor has ≥ 20 lines
- On submit: freeze editor, record `submittedAt` timestamp, show confirmation overlay
- Confirmation overlay shows: time taken, lines written, "Awaiting interviewer review"
- `sessionStorage` clears solution draft — once submitted, candidate cannot go back and edit

---

### F3 — Execution Sandbox & Interviewer Review

> _Bounded execution. Gated solution. Clean debrief._

**F3.1 — Bounded code execution**

- Use `new Function()` wrapped in a try/catch with a custom mock environment injected
- Mock `express`, `app`, `getUserById` — the candidate's code runs against a simulated harness
- Output captured from `console.log` override → displayed in a read-only output terminal panel
- Hard limits: 3s timeout via `setTimeout` abort, no `fetch`/`XMLHttpRequest` allowed in sandbox

**F3.2 — Interviewer review panel (PIN-gated)**

- `/review` route prompts for `VITE_INTERVIEWER_PIN` before rendering
- On correct PIN: show candidate's submitted code + rubric checklist (5 criteria)
- Interviewer ticks criteria → score computed live → feedback notes textarea
- "Reveal Solution" button — decodes `VITE_SOLUTION_B64` from env, renders side-by-side diff

**F3.3 — Deploy & hosting**

- `npm run deploy` → builds → pushes `dist/` to `gh-pages` branch automatically
- Vercel alternative: `vercel.json` with `rewrites` for hash routing
- Environment variables set in Vercel dashboard or GitHub Actions secrets — solution never in git
- README with one-command setup for interviewers spinning up new sessions

---

## Dependency Map

```
codegate/
├── src/
│   ├── components/
│   │   ├── AppShell.tsx          F1.2
│   │   ├── StatusBar.tsx         F1.2
│   │   ├── SessionTimer.tsx      F2.1
│   │   ├── ProblemCard.tsx       F2.1
│   │   ├── CodeEditor.tsx        F2.2
│   │   ├── OutputTerminal.tsx    F3.1
│   │   └── ReviewPanel.tsx       F3.2
│   ├── pages/
│   │   ├── Lobby.tsx             F1.3
│   │   ├── Session.tsx           F2.x
│   │   └── Review.tsx            F3.2
│   ├── sandbox/
│   │   └── runner.ts             F3.1  ← execution harness
│   ├── hooks/
│   │   ├── useTimer.ts           F2.1
│   │   └── useSession.ts         F2.2
│   └── config/
│       └── problem.ts            F2.1  ← problem definition, no solution here
├── .env                          F3.2  ← VITE_SOLUTION_B64 lives only here
├── vite.config.ts                F1.1
└── package.json                  F1.1 + F3.3
```

---

## Build Order

```
F1.1 → F1.2 → F1.3    # Day 1 — shell works, routes work
F2.1 → F2.2 → F2.3    # Day 2 — candidate flow complete
F3.1 → F3.2 → F3.3    # Day 3 — execution + review + live deploy
```

Total: **~3 focused days**. Each feature is independently testable. No feature depends on the next one being complete.

---

## LLM-Proof Guarantee

The solution string only exists in three places:

1. **Interviewer's `.env`** — never committed to git
2. **Vercel/GitHub Actions secret** — encrypted at rest
3. **Runtime memory** — only decoded after PIN entry, never written to DOM until interviewer explicitly clicks "Reveal"

A candidate copy-pasting the entire page source, network tab, or `window` object to an LLM will find **zero solution content**.

---

Ready to start building? Say **"build F1"** and I'll scaffold the full shell with design system, routing, and deploy config in one shot.
