# CodeGate — Interview Sandbox Portal

A browser-based coding interview platform. Candidates write code in a timed Monaco editor; interviewers review submissions through a PIN-gated panel with a side-by-side diff against the canonical solution.

**Stack:** Vite · React · TypeScript · Tailwind CSS · Monaco Editor · `gh-pages`

---

## Interviewer Setup

**1. Clone and install**
```bash
git clone <repo-url> && cd codegate
nvm use 24
npm install
```

**2. Configure environment**
```bash
cp .env.example .env
```
Edit `.env`:
```
VITE_INTERVIEWER_PIN=your6digitpin
VITE_SOLUTION_B64=<btoa("your solution code")>
```
> Never commit `.env`. The solution is only decoded after correct PIN entry — it never appears in the client bundle.

**3. Run locally**
```bash
npm run dev
```

**4. Deploy**
```bash
npm run deploy        # GitHub Pages
# or push to Vercel — set env vars in the Vercel dashboard
```

---

## Candidate Flow

| Route | Purpose |
|---|---|
| `/#/` | Lobby — session start |
| `/#/session` | Timed editor workspace |
| `/#/review` | Interviewer review (PIN-gated) |

- Editor auto-saves every 30s to `sessionStorage`
- Submit unlocks after ≥ 20 lines; freezes editor on confirm
- Timer locks the editor at 0:00

---

## Security

The solution string exists only in `.env` / Vercel secrets and is decoded in runtime memory solely after PIN entry. Candidates inspecting the DOM, network tab, or `window` object will find zero solution content.
