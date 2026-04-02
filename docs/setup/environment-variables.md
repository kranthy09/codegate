# Environment Variables Configuration

Complete guide for setting up environment variables in development, preview, and production environments.

## Overview

CodeGate uses environment variables for:
- **Google Sheets API** credentials (service account)
- **Session management** (secret key)
- **External auth** service URL
- **Code execution** (Piston) endpoint
- **Optional:** Vercel Blob storage for large files

All variables are **server-only** — never expose in `NEXT_PUBLIC_` prefix.

---

## Environment Variables Reference

### Google Sheets Configuration

| Variable | Type | Required | Notes |
|----------|------|----------|-------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | String | Yes | Service account email from GCP |
| `GOOGLE_PRIVATE_KEY` | String (multiline) | Yes | Private key (with `\n` line breaks) |
| `GOOGLE_SHEET_ID` | String | Yes | Spreadsheet ID from URL |

**Setup:**

1. Create Google Cloud project
2. Enable Sheets API
3. Create service account
4. Generate private key (JSON format)
5. Share Google Sheet with service account email
6. Copy credentials to environment

**Format:**
```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=my-app-123@my-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQE...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
```

---

### Session Management

| Variable | Type | Required | Notes |
|----------|------|----------|-------|
| `SESSION_SECRET` | String | Yes | HMAC secret for signing JWTs |
| `SESSION_TTL_HOURS` | Number | No | Default: 8 hours |

**Setup:**

Generate a random secret (base64-encoded):
```bash
# macOS / Linux
openssl rand -base64 32

# Output example: AbC1dEf2GhI3jKlMnOpQrStUvWxYz0aB==
```

Copy to environment for each stage:
```env
SESSION_SECRET=AbC1dEf2GhI3jKlMnOpQrStUvWxYz0aB==
# Optional: customize session TTL
SESSION_TTL_HOURS=12
```

**⚠️ Important:**
- **Must be unique per environment** (dev, preview, production)
- Changing this invalidates all existing sessions
- Keep it secret (never commit unencrypted)

---

### External Authentication

| Variable | Type | Required | Notes |
|----------|------|----------|-------|
| `EXTERNAL_AUTH_URL` | URL | Yes | Your auth server (no trailing slash) |

**Setup:**

Point to your existing authentication server:
```env
# Development
EXTERNAL_AUTH_URL=http://localhost:3001

# Staging / Preview
EXTERNAL_AUTH_URL=https://auth-staging.example.com

# Production
EXTERNAL_AUTH_URL=https://auth.example.com
```

**Auth Contract:**

Your server must respond to `GET /auth/me/` with cookie `access_token`:
```json
{
  "id": "user-123",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "admin|manager|interviewer|interviewee",
  "role_id": "optional-role-id",
  "screening_type_id": "optional-screening-type-id",
  "difficulty": "optional-difficulty-level"
}
```

---

### Code Execution (Piston)

| Variable | Type | Required | Notes |
|----------|------|----------|-------|
| `CODE_EXECUTION_URL` | URL | Yes | Piston API endpoint (no trailing slash) |

**Setup:**

**Option A: Self-Hosted (Production)**
```env
# Your Piston VPS
CODE_EXECUTION_URL=http://123.45.67.89:2000

# Or with domain / reverse proxy
CODE_EXECUTION_URL=https://piston.example.com
```

See [piston-deployment.md](./piston-deployment.md) for setup.

**Option B: Public emkc.org (Dev/Testing)**
```env
# Free public endpoint (rate-limited)
CODE_EXECUTION_URL=https://emkc.org
```

**⚠️ Production Warning:**
- Never use `https://emkc.org` in production
- Public endpoint is rate-limited and unreliable
- Self-host Piston for production reliability

---

### Vercel Blob Storage (Optional)

| Variable | Type | Required | Notes |
|----------|------|----------|-------|
| `BLOB_READ_WRITE_TOKEN` | String | No | For storing large Excalidraw drawings |

**Setup (if needed):**

1. Vercel Dashboard → Storage → Blob → Create Token
2. Select Read + Write permissions
3. Copy token to environment

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_abc123def456...
```

**Use case:** Excalidraw drawings > 100KB (stores JSON in Vercel Blob instead of Google Sheets)

---

## Environment-Specific Configuration

### Development

Use `.env.local` (not committed):

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=my-app-dev@my-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=dev_sheet_id_here

SESSION_SECRET=dev_secret_12345678901234567890

EXTERNAL_AUTH_URL=http://localhost:3001
CODE_EXECUTION_URL=https://emkc.org
```

Run locally:
```bash
npm run dev
# Server reads .env.local and .env.example
```

### Preview (Staging on Vercel)

**In Vercel Dashboard:**
1. Go to Project → Settings → Environment Variables
2. For each variable, select **Preview** environment

Use a **staging/preview Google Sheet**:

```
GOOGLE_SHEET_ID=preview_sheet_id (different from production)
SESSION_SECRET=preview_secret_unique_per_environment
EXTERNAL_AUTH_URL=https://auth-staging.example.com
CODE_EXECUTION_URL=https://emkc.org (or staging Piston)
```

**Triggered by:**
- Push to non-main branches (e.g., `develop`, feature branches)
- Pull requests
- Vercel CLI: `vercel deploy --prebuilt`

### Production

**In Vercel Dashboard:**
1. Go to Project → Settings → Environment Variables
2. For each variable, select **Production** environment

Use a **production Google Sheet**:

```
GOOGLE_SHEET_ID=prod_sheet_id
SESSION_SECRET=prod_secret_unique_per_environment
EXTERNAL_AUTH_URL=https://auth.example.com
CODE_EXECUTION_URL=https://piston.example.com (self-hosted)
```

**Triggered by:**
- Push to `main` branch
- Manual deployment from Vercel Dashboard

---

## Vercel Configuration Checklist

### Step 1: Add Variables to Vercel Dashboard

Go to **Settings → Environment Variables**:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL
  ✓ Production   ✓ Preview   ✓ Development

GOOGLE_PRIVATE_KEY
  ✓ Production   ✓ Preview   ✓ Development
  Mark as "Secret"

GOOGLE_SHEET_ID
  ✓ Production (prod sheet)
  ✓ Preview (staging sheet)
  ✓ Development (dev sheet)

SESSION_SECRET
  ✓ Production (unique)
  ✓ Preview (unique)
  ✓ Development (unique)
  Mark as "Secret"

EXTERNAL_AUTH_URL
  ✓ Production (prod auth)
  ✓ Preview (staging auth)
  ✓ Development (local auth)

CODE_EXECUTION_URL
  ✓ Production (self-hosted Piston)
  ✓ Preview (emkc.org or staging Piston)
  ✓ Development (emkc.org)
```

### Step 2: Verify Variables Are Accessible

After setting variables, verify they're loaded:

```bash
# Deploy a simple API route that logs environment
# (remove logs before going to production)

curl https://your-app.vercel.app/api/health
# Should return: { "status": "ok", "auth_url_reachable": true }
```

### Step 3: Test Each Environment

**Development:**
```bash
npm run dev
# Open http://localhost:3000
# Should load dashboard with .env.local values
```

**Preview (Staging):**
```bash
# Push to non-main branch
git push origin develop
# Vercel auto-deploys to preview URL
# Open preview URL
# Should load dashboard with preview sheet data
```

**Production:**
```bash
# Push to main
git push origin main
# Vercel auto-deploys to production
# Open https://your-app.vercel.app
# Should load dashboard with production sheet data
```

---

## Security Best Practices

1. **Never commit `.env.local`**
   ```bash
   # Already in .gitignore
   echo ".env.local" >> .gitignore
   ```

2. **Never expose secrets in client**
   - No `NEXT_PUBLIC_` prefix on sensitive variables
   - All auth/sheets variables are server-only

3. **Rotate `SESSION_SECRET` periodically**
   - Invalidates all active sessions
   - Plan for user re-authentication

4. **Audit access to Vercel Dashboard**
   - Limit who can view/edit environment variables
   - Enable SAML/SSO for team access

5. **Secure Piston VPS**
   - Firewall to allow only Vercel IPs
   - Use reverse proxy with authentication headers
   - See [piston-deployment.md](./piston-deployment.md#piston-security-hardening)

---

## Troubleshooting

### "Cannot find GOOGLE_SERVICE_ACCOUNT_EMAIL"

**Cause:** Variable not set in Vercel Dashboard or `.env.local`  
**Fix:**
```bash
# Check .env.local exists
cat .env.local | grep GOOGLE_SERVICE_ACCOUNT_EMAIL

# Or in Vercel Dashboard, verify variable is added
```

### "EXTERNAL_AUTH_URL is not reachable from Vercel"

**Cause:** Auth service doesn't allow Vercel IP ranges  
**Fix:**
1. Add Vercel IP ranges to your firewall
2. Check auth server is running and accessible
3. Verify `EXTERNAL_AUTH_URL` has no trailing slash

### "Code execution times out"

**Cause:** Piston not reachable or overloaded  
**Fix:**
1. Verify `CODE_EXECUTION_URL` is correct
2. Check Piston VPS is running
3. Increase `maxDuration` in [vercel.json](../../vercel.json)

### "All deployments fail silently"

**Cause:** Missing critical environment variable (fails during build)  
**Fix:**
```bash
# Check Vercel build logs
# Vercel Dashboard → Deployments → [failed deployment] → View Logs

# Verify all required variables are set:
# - GOOGLE_SERVICE_ACCOUNT_EMAIL
# - GOOGLE_PRIVATE_KEY
# - GOOGLE_SHEET_ID
# - SESSION_SECRET
# - EXTERNAL_AUTH_URL
# - CODE_EXECUTION_URL
```

---

## Reference

- [.env.example](../../.env.example) — Template for all variables
- [vercel.json](../../vercel.json) — Vercel build configuration
- [GitHub & Vercel Setup](./github-vercel-setup.md) — Deployment walkthrough
- [Piston Deployment](./piston-deployment.md) — Code execution setup
- [Phase 7: Deployment](../implementation/phase-7-deployment.md) — Full deployment checklist
