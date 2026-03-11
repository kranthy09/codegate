# CodeGate — Architecture Reference

## Project Identity
**CodeGate** is a browser-based interview sandbox portal. Candidates write code in a monitored editor; interviewers review submissions via a PIN-gated panel with a side-by-side diff against the canonical solution.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Bundler | Vite | Fast HMR, static output for `gh-pages` |
| UI Framework | React 18 + TypeScript | Component model, type safety |
| Styling | Tailwind CSS | Utility-first, no runtime cost |
| Code Editor | `@monaco-editor/react` | Full Monaco (VS Code engine) in React |
| Routing | `react-router-dom` (hash mode) | Works on GitHub Pages without server config |
| Deployment | `gh-pages` or Vercel | Static hosting, env vars for secrets |

---

## Typography & Design System

**Font pairing:**
- `Fraunces` — display / headings (`@fontsource/fraunces`)
- `JetBrains Mono` — all code surfaces (`@fontsource/jetbrains-mono`)
- `DM Sans` — body / UI text (`@fontsource/dm-sans`)

**Design direction:** Clean white, editorial, professional — high-end technical documentation meets coding exam room.

**CSS design tokens** (defined as CSS custom properties in `index.css`):
```css
--color-surface      /* page background */
--color-panel        /* card / pane backgrounds */
--color-border       /* dividers */
--color-accent       /* primary action color */
--color-danger       /* timer red, error states */
--color-warning      /* timer amber */
--radius-md          /* standard border radius */
--shadow-card        /* card elevation */
```

---

## Directory Structure

```
codegate/
├── src/
│   ├── components/
│   │   ├── AppShell.tsx        # Header + layout wrapper + status strip
│   │   ├── StatusBar.tsx       # Session state pill (idle / active / submitted)
│   │   ├── SessionTimer.tsx    # Countdown timer with color thresholds
│   │   ├── ProblemCard.tsx     # Problem statement renderer
│   │   ├── CodeEditor.tsx      # Monaco editor wrapper
│   │   ├── OutputTerminal.tsx  # Read-only console output pane
│   │   └── ReviewPanel.tsx     # Rubric + diff reveal for interviewer
│   ├── pages/
│   │   ├── Lobby.tsx           # Entry page, session start
│   │   ├── Session.tsx         # Main candidate workspace
│   │   └── Review.tsx          # PIN-gated interviewer review
│   ├── sandbox/
│   │   └── runner.ts           # Bounded code execution harness
│   ├── hooks/
│   │   ├── useTimer.ts         # Countdown timer logic
│   │   └── useSession.ts       # Editor state, auto-save, submission
│   └── config/
│       └── problem.ts          # Problem definition (NO solution here)
├── .env                        # VITE_INTERVIEWER_PIN + VITE_SOLUTION_B64 (never committed)
├── .env.example                # Template for interviewers
├── vite.config.ts              # base: '/codegate/' for gh-pages
├── vercel.json                 # Hash routing rewrites (Vercel alternative)
└── package.json                # Scripts including deploy
```

---

## Routing Architecture

```
/           → Lobby.tsx         (public)
/session    → Session.tsx       (public during active session)
/review     → Review.tsx        (PIN-gated, interviewer only)
```

- Hash routing (`createHashRouter`) ensures all routes resolve on GitHub Pages.
- Transitions: subtle CSS fade between route changes.
- The `/review` route renders a PIN prompt **before** any candidate data or solution is shown.

---

## Layout Structure

```
AppShell
├── Header bar         (logo, session name, StatusBar)
├── Main content area
│   ├── Problem pane   (40% width)  — ProblemCard + SessionTimer
│   └── Editor pane    (60% width)  — CodeEditor + OutputTerminal
└── Status strip       (word count, line count, autosave indicator)
```

Responsive breakpoints:
- Desktop (≥1024px): side-by-side split panes
- Mobile (<1024px): stacked, problem pane collapses to accordion

---

## Security / LLM-Proof Architecture

The solution string **never** exists in the client bundle at build time.

```
Solution lifecycle:
  Interviewer .env  ──→  Vercel/GH Actions secret (encrypted)
                                  │
                         Base64-encoded env var
                                  │
                         Decoded ONLY after PIN entry
                                  │
                         Written to DOM ONLY on explicit "Reveal Solution" click
```

**Candidate attack surface = zero:**
- No solution in `window`, DOM, network tab, or source bundle
- `sessionStorage` holds only the candidate's own draft code
- After submission, draft is cleared from `sessionStorage`

---

## Environment Variables

```env
VITE_INTERVIEWER_PIN=<6-digit PIN>
VITE_SOLUTION_B64=<btoa(solution_code_string)>
```

- Both are Vite public env vars (accessible client-side) — the security model relies on the PIN gate, not obscurity of variable names.
- Never commit `.env` to git. `.env.example` with placeholder values is committed.

---

## Deployment

**GitHub Pages:**
```bash
npm run deploy   # builds + pushes dist/ to gh-pages branch
```
`vite.config.ts` must have `base: '/codegate/'`.

**Vercel:**
- Add env vars in Vercel dashboard
- `vercel.json` rewrites all routes to `index.html` for hash routing compatibility
