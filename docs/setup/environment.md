# Environment Variables

Copy `.env.example` to `.env.local` for local development. Never commit `.env.local`.

---

## Required Variables

### Google Sheets — Service Account

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=codegate-service@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=your_google_sheet_id_here
```

### Internal Session Signing

```env
# Random 32+ char secret for signing cg_session cookie
# Generate: openssl rand -base64 32
SESSION_SECRET=your-random-secret-here
```

### External Auth Service

```env
# Base URL of your existing auth server (no trailing slash)
# The app calls: EXTERNAL_AUTH_URL/auth/me/
EXTERNAL_AUTH_URL=https://your-auth-service.example.com
```

### Code Execution (Piston)

```env
# Self-hosted Piston: http://your-piston-host:2000
# Public emkc.org endpoint: https://emkc.org
CODE_EXECUTION_URL=https://emkc.org
```

---

## Optional Variables

```env
# Vercel Blob token — only needed if Excalidraw drawings exceed 100KB
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Override session TTL in hours (default: 8)
SESSION_TTL_HOURS=8
```

---

## Vercel Dashboard Setup

Project Settings → Environment Variables. Set for Production, Preview, and Development.

`GOOGLE_PRIVATE_KEY`: paste the full PEM string. Vercel handles line breaks correctly.

`EXTERNAL_AUTH_URL`: point Preview environments at your staging auth server.

`CODE_EXECUTION_URL`: can point at the public emkc.org endpoint for development/preview. Use self-hosted for production.

---

## What Was Removed

No `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, or `GOOGLE_CLIENT_SECRET`. Auth is handled entirely by the external auth system + our custom `SESSION_SECRET`.

---

## Local Development

```bash
cp .env.example .env.local
# Fill in all required vars
npm install
npm run dev
```
