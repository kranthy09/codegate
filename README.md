# CodeGate

Interview screening portal — define questions in Google Sheets, run live sessions (text / code / system design), score in real time, sync results back to Sheets.

## Prerequisites

- Node.js 18+
- A Google Cloud service account with Sheets API enabled
- An external auth service that returns user identity via `/auth/me/`

## Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Fill in: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID,
#          SESSION_SECRET, EXTERNAL_AUTH_URL, CODE_EXECUTION_URL

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Google Sheet Setup

Share your Google Sheet with the service account email and create these tabs:

`roles` · `screening_types` · `questions` · `candidates` · `screenings` · `responses` · `code_submissions` · `drawings` · `users` · `candidate_pipeline` · `api_keys`

Full schema: [docs/reference/data-schema.md](docs/reference/data-schema.md)

## Deploy

```bash
npm run build
```

Deploy to Vercel with the same env vars set in the dashboard.
