
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
