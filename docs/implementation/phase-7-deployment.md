# Phase 7: Deployment

Deploy CodeGate to production on Vercel with environment configuration, Piston code execution service, external auth integration, and external API key management. Full end-to-end testing and monitoring.

## Deployment Overview

This phase involves:
1. **GitHub Setup** → Push code to GitHub
2. **Vercel Integration** → Connect and deploy
3. **Environment Configuration** → Set secrets and database references
4. **Piston Deployment** → Self-hosted code execution service
5. **Full Testing** → ISR, auth, screening flows, external API
6. **Monitoring** → Production observability and alerting
7. **Documentation** → Operations runbooks and incident response

**Timeline:** 4-6 hours for initial setup + testing

---

## Prerequisites Checklist

Before starting Phase 7:

- [ ] All code from Phases 0-6 is implemented and tested locally
- [ ] Google Sheets with all 11 tabs created (see [data-schema.md](../reference/data-schema.md))
- [ ] Service account created in Google Cloud with Sheets API enabled
- [ ] External auth service reachable at `EXTERNAL_AUTH_URL`
- [ ] Vercel account created (free or paid)
- [ ] GitHub account with new repository created
- [ ] VPS with Docker ready for Piston (if self-hosting code execution)

---

## Tasks & Implementation

### 1. GitHub Repository Setup

Push CodeGate to GitHub for Vercel integration.

**Steps:**
1. Create GitHub repository (public or private)
2. Add remote: `git remote add origin https://github.com/YOUR_USERNAME/codegate.git`
3. Review `.gitignore` to ensure `.env*` is excluded
4. Push: `git push -u origin main`

**See:** [GitHub & Vercel Setup](../setup/github-vercel-setup.md#step-1-prepare-github-repository)

**Expected:** Code appears on GitHub.com, `.env.local` is not committed

---

### 2. Vercel Project Creation & Deployment

Connect GitHub to Vercel and deploy.

**Steps:**
1. Create Vercel project via vercel.com
2. Import GitHub repository (authorizes GitHub app)
3. Configure project settings (auto-detected as Next.js)
4. Add all environment variables (see next task)
5. Deploy

**See:** [GitHub & Vercel Setup](../setup/github-vercel-setup.md#step-2-connect-to-vercel)

**Expected:** First deployment succeeds, get preview URL like `https://codegate-abc123.vercel.app`

---

### 3. Environment Variables Configuration

Set up secrets and configuration in Vercel for production, preview, and development.

**Variables to configure:**

| Variable | Production | Preview | Development |
|----------|-----------|---------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ✓ | ✓ | ✓ |
| `GOOGLE_PRIVATE_KEY` | ✓ | ✓ | ✓ |
| `GOOGLE_SHEET_ID` | prod sheet | staging sheet | dev sheet |
| `SESSION_SECRET` | unique secret | unique secret | unique secret |
| `EXTERNAL_AUTH_URL` | prod auth | staging auth | local auth |
| `CODE_EXECUTION_URL` | self-hosted Piston | emkc.org/self-hosted | emkc.org |
| `BLOB_READ_WRITE_TOKEN` | optional | optional | optional |

**See:** [Environment Variables Guide](../setup/environment-variables.md)

**Expected:** All 6+ variables set for each environment, build succeeds

---

### 4. Piston Code Execution Deployment

Deploy Piston on a separate VPS for sandboxed code execution.

**Options:**

**Option A: Self-Hosted VPS (Recommended)**
1. SSH to VPS (Ubuntu 20.04+, 2+ CPU, 4GB RAM)
2. Clone Piston: `git clone https://github.com/engineer-man/piston`
3. Start Docker Compose: `docker-compose up -d`
4. Install language runtimes (Python, JavaScript, Java, Go, C++, Rust)
5. (Optional) Set up nginx reverse proxy with TLS
6. Set `CODE_EXECUTION_URL` in Vercel to VPS endpoint

**Option B: Public emkc.org (Dev/Testing Only)**
1. Set `CODE_EXECUTION_URL=https://emkc.org` in Vercel
2. ⚠️ Not suitable for production (rate-limited, shared)

**See:** [Piston Deployment Guide](../setup/piston-deployment.md)

**Expected:** Code execution responds < 1s for simple scripts, < 10s for complex code

---

### 5. Verify External Auth Integration

Ensure your auth service is reachable from Vercel.

**Test:**
1. Navigate to `https://your-app.vercel.app/`
2. Should redirect to `EXTERNAL_AUTH_URL/auth/me/`
3. After auth, should set `cg_session` cookie (internal JWT)
4. Should load dashboard or candidate session

**Expected:** Auth flow completes without 401 or network errors

---

### 6. Verify Configuration & Deployment

Test critical infrastructure before functional testing.

**Tests:**

| Test | Command | Expected |
|------|---------|----------|
| Deployment health | `curl https://your-app.vercel.app/api/health` | 200 OK |
| ISR caching (first) | `curl -I https://your-app.vercel.app/api/questions` | `X-Vercel-Cache: MISS` |
| ISR caching (second) | Same request again | `X-Vercel-Cache: HIT` |
| Auth can reach Sheets | Verify `cg_session` created | Cookie exists, user loaded |

**See:** [Verification Guide — ISR Testing](../deployment/verification.md#isr--caching-verification)

**Expected:** Caching works, auth succeeds, APIs respond

---

### 7. Full End-to-End Screening Flow Test

Test all three question types and submission flow.

**Scenario: Interviewee completes screening**

1. **Text Question**
   - Answer question
   - Submit
   - Verify saved to `responses` sheet

2. **Code Question**
   - Monaco editor loads
   - Edit code and click "Run"
   - Verify code executes on Piston (< 10s)
   - Output appears in console
   - Submit
   - Verify saved to `code_submissions` sheet

3. **System Design Question**
   - Excalidraw canvas loads
   - Draw on canvas
   - Auto-save to `drawings` sheet
   - Submit

4. **Interview Review & Submit**
   - Sign in as interviewer
   - View candidate's submissions (read-only)
   - Score each response (1-5)
   - Click "Submit Screening"
   - Verify atomic update:
     - `responses` has scores
     - `candidate_pipeline` has new snapshot
     - `screenings` marked completed

**See:** [Verification Guide — Functional Testing](../deployment/verification.md#functional-end-to-end-testing)

**Expected:** All submissions saved, no missing data, atomic updates

---

### 8. External API Key Management & Testing

Set up external API keys for ATS/HR tool integration.

**Steps:**

1. **Admin creates API key:**
   ```bash
   curl -X POST https://your-app.vercel.app/api/admin/api-keys \
     -H "Cookie: cg_session=<admin_token>" \
     -H "Content-Type: application/json" \
     -d '{"name": "ATS Sync", "scope": ["candidates", "screenings", "reports"]}'
   ```
   
   Response includes `key` (shown once, store securely)

2. **Test external API endpoints:**
   - `GET /api/external/candidates` → List all candidates
   - `GET /api/external/candidates/[id]/pipeline` → Full pipeline snapshot
   - `GET /api/external/reports` → Aggregated reports
   
   All require `Authorization: Bearer <key>` header

3. **Verify key validation:**
   - Invalid key → 401
   - Revoked key (active=FALSE) → 401
   - Insufficient scope → 403

4. **Verify audit trail:**
   - Each key has `last_used_at` timestamp
   - Updated on every API call
   - Admin can view usage history

**See:** [Verification Guide — External API Testing](../deployment/verification.md#external-api-testing)

**Expected:** Keys created, endpoints work, validation enforces scope

---

### 9. Load Testing & Performance

Simulate concurrent users to verify no quota/timeout issues.

**Test Scenario: 10 concurrent screenings**

```bash
# Script: simulate 10 interviewees submitting code simultaneously
for i in {1..10}; do
  curl -X POST https://your-app.vercel.app/api/code-submissions \
    -H "Cookie: cg_session=<token_$i>" \
    -H "Content-Type: application/json" \
    -d '{"screening_id": "scr_'$i'", "code": "print('"'"'test'"'"')"}' &
done
wait
```

**Verify:**
- All 10 submissions succeed (no 500 errors)
- No Sheets API quota exhaustion (check Google Cloud Console)
- Response times < 2s
- Piston doesn't timeout

**See:** [Verification Guide — Performance Testing](../deployment/verification.md#performance-testing)

**Expected:** Concurrent throughput meets expectations, no quota limits hit

---

### 10. Deployment Protection & Safeguards

Set up controls to prevent accidental production changes.

**In Vercel Dashboard:**

- [ ] **Settings → Git** → Verify `main` branch auto-deploys to Production
- [ ] **Settings → Protection** → (Optional) Require approval for production deploys
- [ ] **Settings → Protection** → Restrict who can promote to production
- [ ] **Analytics** → Enable Web Vitals monitoring
- [ ] **Logs** → Review recent deployments and errors

**Expected:** Main branch controls production, preview deployments test changes

---

## Configuration Files

### vercel.json

[vercel.json](../../vercel.json) specifies:
- Region: `iad1` (US East, nearest to Google Sheets US endpoints)
- `/api/execute` timeout: 15s (allows Piston cold boots)

```json
{
  "regions": ["iad1"],
  "functions": {
    "src/app/api/execute/route.ts": {
      "maxDuration": 15
    }
  }
}
```

### .env.example

[.env.example](../../.env.example) documents all environment variables:
- Google Sheets credentials
- Session management
- External auth URL
- Code execution endpoint
- Optional Vercel Blob storage

No secrets in `.env.example`, only template structure.

---

## Documentation Reference

Complete Phase 7 documentation:

| Document | Purpose |
|----------|---------|
| [GitHub & Vercel Setup](../setup/github-vercel-setup.md) | Step-by-step GitHub push and Vercel deployment |
| [Environment Variables](../setup/environment-variables.md) | All variables, per-environment config, Vercel dashboard setup |
| [Piston Deployment](../setup/piston-deployment.md) | Self-hosted and public Piston endpoints, VPS hardening, troubleshooting |
| [Verification & Testing](../deployment/verification.md) | ISR, auth, functional, performance, external API test checklists |
| [Monitoring & Observability](../deployment/monitoring.md) | Vercel analytics, logging, alerting, runbooks, incident response |

---

## Functional Checklist

Complete all tests before marking Phase 7 done:

- [ ] Code pushed to GitHub, visible on GitHub.com
- [ ] Vercel deployment succeeds, preview URL accessible
- [ ] All environment variables set (6+ variables across 3 environments)
- [ ] External auth redirects and authenticates users
- [ ] RBAC enforced (admin can access `/admin/*`, interviewer cannot)
- [ ] ISR caching works (questions endpoint: MISS then HIT)
- [ ] Piston executes code < 10s, sandboxed
- [ ] Text question: answer saved to `responses` sheet
- [ ] Code question: code + execution result saved to `code_submissions` sheet
- [ ] Design question: Excalidraw JSON saved to `drawings` sheet
- [ ] Interviewer submit: atomic update to responses + pipeline + screenings
- [ ] Candidate dashboard: shows all stages and scores
- [ ] External API: admin can create keys
- [ ] External API: 3rd-party tools can query candidates + pipeline
- [ ] External API: invalid/revoked keys return 401
- [ ] Load test: 10 concurrent screenings complete without errors
- [ ] Monitoring: Vercel Analytics shows Core Web Vitals
- [ ] Monitoring: no sensitive env vars in client bundle

---

## Performance Checklist

- [ ] Questions page (ISR cached): < 500ms
- [ ] Screening session load: < 2s
- [ ] Code execution (typical): < 10s
- [ ] Concurrent throughput: 10+ screenings simultaneously
- [ ] Core Web Vitals: all green (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [ ] No GOOGLE_*, SESSION_SECRET, EXTERNAL_AUTH_URL in client JS bundle

---

## Troubleshooting

### Deployment fails: "Cannot find module 'googleapis'"

**Cause:** `serverExternalPackages` not set  
**Fix:** Check [next.config.ts](../../next.config.ts) has `serverExternalPackages: ['googleapis']`

### Build times out: TypeScript errors

**Fix:** Run `npm run build` locally, fix errors, push again

### Auth always redirects, won't authenticate

**Cause:** `EXTERNAL_AUTH_URL` unreachable or misconfigured  
**Fix:** Verify URL is correct (no trailing slash), auth service allows Vercel IPs

### Code execution times out every time

**Cause:** Piston not reachable or overloaded  
**Fix:** Check Piston VPS health, increase `maxDuration` in vercel.json, verify `CODE_EXECUTION_URL`

### Sheets API returns 503 Service Unavailable

**Cause:** Daily quota exhausted  
**Fix:** Wait for quota reset (UTC midnight), request quota increase from Google

See [Monitoring & Observability](../deployment/monitoring.md) for full runbooks.

---

## Next: Post-Deployment

Once Phase 7 is complete:

1. **Monitor:** Set up daily/weekly/monthly monitoring checks (see [Monitoring](../deployment/monitoring.md))
2. **Operate:** Use [Monitoring](../deployment/monitoring.md) for incident response
3. **Scale:** As load increases, optimize Sheets usage, scale Piston VPS, or switch to dedicated database
4. **Iterate:** Gather feedback from interviewers and candidates, plan Phase 8 improvements

---

See also:
- [Phase Map](../../CLAUDE.md#phase-map) — All phases
- [Deployment Overview](../../CLAUDE.md#vercel-deployment-constraints) — Architecture decisions
- [Data Schema](../reference/data-schema.md) — Google Sheets structure
