
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
