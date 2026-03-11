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
