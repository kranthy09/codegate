# Deployment Verification & Testing

Complete testing checklist after deploying CodeGate to Vercel. Run these tests to ensure all systems are working correctly in production.

---

## ISR & Caching Verification

Verify that Incremental Static Regeneration (ISR) is working for read-heavy endpoints.

### Test 1: Questions ISR Caching

Questions are cached and revalidated every 60 seconds.

```bash
# First request (should be MISS)
curl -I https://your-app.vercel.app/api/questions
# Look for: X-Vercel-Cache: MISS

# Wait a moment, second request (should be HIT)
curl -I https://your-app.vercel.app/api/questions
# Look for: X-Vercel-Cache: HIT

# Wait > 60 seconds
sleep 61

# Third request (should revalidate, then HIT)
curl -I https://your-app.vercel.app/api/questions
# Look for: X-Vercel-Cache: HIT (after revalidation)
```

**Expected behavior:**
- First request: `MISS` (no cache)
- Subsequent requests: `HIT` (cached for 60s)
- After 60s: revalidate in background, `HIT` with fresh data

### Test 2: Roles & Screening Types Caching

Verify static data is cached:

```bash
# All three should return X-Vercel-Cache: HIT on second request
curl -I https://your-app.vercel.app/api/roles
curl -I https://your-app.vercel.app/api/screening-types
```

---

## Authentication & Authorization Testing

### Test 3: External Auth Integration

Verify your auth server is reachable from Vercel:

```bash
# Navigate to your app
open https://your-app.vercel.app

# Should redirect to EXTERNAL_AUTH_URL/auth/me/
# After auth, should set cg_session cookie and load dashboard
```

Check cookies in browser DevTools:
```javascript
// Console
document.cookie
// Should include: cg_session=<jwt_token>
```

### Test 4: Role-Based Access Control

**Admin User:**
```bash
# Should access /admin/questions
curl -H "Cookie: cg_session=<admin_token>" \
  https://your-app.vercel.app/admin/questions
# Should return: 200 (questions page)
```

**Interviewer User:**
```bash
# Should NOT access /admin/questions
curl -H "Cookie: cg_session=<interviewer_token>" \
  https://your-app.vercel.app/admin/questions
# Should return: 403 Forbidden
```

**Interviewee User:**
```bash
# Should only access their assigned session
curl -H "Cookie: cg_session=<interviewee_token>" \
  https://your-app.vercel.app/session/[id]
# Should return: 200 (their session)

# Should NOT access admin areas
curl -H "Cookie: cg_session=<interviewee_token>" \
  https://your-app.vercel.app/admin/questions
# Should return: 403 Forbidden
```

---

## Functional End-to-End Testing

### Test 5: Text Question Flow

1. Sign in as interviewee
2. Navigate to assigned screening with text question
3. Answer question and submit
4. Verify in Google Sheets:
   - `responses` sheet has entry with score
   - Answer text is stored

**Expected:** Text answers saved with timestamp

### Test 6: Code Question Flow

1. Sign in as interviewee
2. Navigate to code question
3. Monaco editor loads with starter code
4. Edit code, click **"Run"**
5. Verify:
   - Code executes on Piston
   - Output appears in console
   - No timeout (should complete < 10s)
6. Click **"Submit"**
7. Verify in Google Sheets:
   - `code_submissions` sheet has entry
   - Code and execution output stored

**Expected:** Code executions are proxied through `/api/execute`, not called directly from client

### Test 7: System Design Question Flow

1. Sign in as interviewee
2. Navigate to design question
3. Excalidraw canvas loads
4. Draw on canvas
5. Auto-save should trigger
6. Verify in Google Sheets:
   - `drawings` sheet has entry
   - Excalidraw JSON stored

**Expected:** Drawings persist and sync to Sheets

### Test 8: Interviewer Review & Submit

1. Sign in as interviewer
2. Navigate to assigned screening
3. View candidate's code submissions (read-only Monaco)
4. View candidate's drawings (read-only Excalidraw)
5. Score each response (1-5 scale)
6. Add comments/notes
7. Click **"Submit Screening"**
8. Verify in Google Sheets (should all update within 5 seconds):
   - `responses` updated with scores
   - `screenings` marked as completed
   - `candidate_pipeline` has new snapshot row

**Expected:** All updates are atomic (all succeed or all fail)

---

## External API Testing

### Test 9: API Key Creation

Admin creates API key:

```bash
curl -X POST https://your-app.vercel.app/api/admin/api-keys \
  -H "Cookie: cg_session=<admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test ATS Integration",
    "scope": ["candidates", "screenings", "reports"]
  }'

# Response:
{
  "id": "api_key_001",
  "name": "Test ATS Integration",
  "key": "pk_live_abc123def456...",
  "scope": ["candidates", "screenings", "reports"],
  "created_at": "2026-04-02T12:00:00Z"
}
```

Store the `key` value (shown only once).

### Test 10: External API - Candidates

3rd-party tool queries candidate pipeline:

```bash
curl https://your-app.vercel.app/api/external/candidates \
  -H "Authorization: Bearer pk_live_abc123def456..."

# Should return:
{
  "candidates": [
    {
      "id": "cand_001",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "applied_role_id": "role_001",
      "status": "in_progress|passed|rejected",
      "created_at": "2026-04-01T10:00:00Z"
    }
  ]
}
```

### Test 11: External API - Pipeline Snapshot

Get full pipeline for a candidate:

```bash
curl https://your-app.vercel.app/api/external/candidates/[candidate_id]/pipeline \
  -H "Authorization: Bearer pk_live_abc123def456..."

# Should return:
{
  "candidate": { ... },
  "pipeline_snapshots": [
    {
      "screening_id": "scr_001",
      "status": "completed",
      "overall_score": 4,
      "recommendation": "yes",
      "responses_json": [...],
      "code_submissions_json": [...],
      "drawings_json": [...],
      "completed_at": "2026-04-02T15:30:00Z"
    }
  ]
}
```

### Test 12: External API - Invalid Key

Invalid or revoked keys return 401:

```bash
curl https://your-app.vercel.app/api/external/candidates \
  -H "Authorization: Bearer invalid_key_123"

# Should return:
# 401 Unauthorized
{
  "error": "Invalid API key"
}
```

### Test 13: External API - Scope Validation

Key with wrong scope should reject:

```bash
# Create key with scope: ["reports"] only
curl -X POST https://your-app.vercel.app/api/admin/api-keys \
  -H "Cookie: cg_session=<admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Reports Only",
    "scope": ["reports"]
  }'

# Try to access candidates endpoint (should fail)
curl https://your-app.vercel.app/api/external/candidates \
  -H "Authorization: Bearer pk_live_reports_only..."

# Should return:
# 403 Forbidden
{
  "error": "Insufficient scope"
}
```

### Test 14: API Audit Trail

Admin views API key usage:

```bash
curl https://your-app.vercel.app/api/admin/api-keys \
  -H "Cookie: cg_session=<admin_token>"

# Should show each key with last_used_at timestamp
[
  {
    "id": "api_key_001",
    "name": "Test ATS Integration",
    "scope": ["candidates", "screenings", "reports"],
    "active": true,
    "created_at": "2026-04-02T12:00:00Z",
    "last_used_at": "2026-04-02T12:15:00Z"
  }
]
```

---

## Performance Testing

### Test 15: API Response Times

Measure performance from Vercel:

```bash
# Questions (ISR cached, should be < 500ms)
time curl https://your-app.vercel.app/api/questions

# Screening load (batch read from Sheets, should be < 2s)
time curl https://your-app.vercel.app/api/screenings/[id]

# Code execution (via Piston, should be < 10s)
time curl -X POST https://your-app.vercel.app/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "source": "print(range(1000))"
  }'
```

**Expected thresholds:**
- ISR cached endpoints: < 500ms
- Screening load: < 2s
- Code execution: < 10s

### Test 16: Concurrent Load Test

Simulate 10 concurrent screenings:

```bash
# Script: load-test.sh
#!/bin/bash

for i in {1..10}; do
  (
    # Interviewee submits code
    curl -X POST https://your-app.vercel.app/api/code-submissions \
      -H "Cookie: cg_session=<token_$i>" \
      -H "Content-Type: application/json" \
      -d '{
        "screening_id": "scr_'$i'",
        "question_id": "q_code_001",
        "language": "python",
        "code": "print('"'"'Solution '$i''"'"')"
      }' &
  )
done
wait

echo "All 10 submissions completed"
```

**Expected:** All submissions succeed without rate limiting

### Test 17: Bundle Size & Metrics

Check Core Web Vitals:

**In Vercel Dashboard:**
1. Project → **Analytics** → **Web Vitals**
2. Check:
   - **LCP** (Largest Contentful Paint): < 2.5s
   - **FID** (First Input Delay): < 100ms
   - **CLS** (Cumulative Layout Shift): < 0.1

**Expected:** Green scores on all metrics

### Test 18: Bundle Size Check

Verify no secrets in bundle:

```bash
# Build locally
npm run build

# Check bundle doesn't contain GOOGLE_SERVICE_ACCOUNT_EMAIL
grep -r "GOOGLE_SERVICE_ACCOUNT_EMAIL" .next/static/
# Should return nothing

# Check bundle size
ls -lh .next/static/chunks/
# Should all be < 1MB per chunk
```

**Expected:** No sensitive env vars in client JS

---

## Data Consistency Testing

### Test 19: Sheet Updates Are Atomic

When interviewer submits screening, all sheets update together:

1. Interviewer submits scores for screening
2. Immediately query Google Sheets for:
   - `responses` → should have new rows
   - `candidate_pipeline` → should have new snapshot
   - `screenings` → should have updated status
3. All three should be present (no partial writes)

**Expected:** All updates within 5 seconds, no missing data

### Test 20: Sheets API Quota Usage

Monitor API quota consumption:

**In Google Cloud Console:**
1. Project → **APIs & Services** → **Quotas**
2. Filter: Sheets API
3. Check usage over peak hours
4. Expected: < 80% of daily quota during load test

---

## Regression Testing

### Test 21: Session Expiry

After `SESSION_TTL_HOURS` (default 8):

1. User is logged in
2. Wait 8+ hours
3. Make any API call
4. Verify: new call to `EXTERNAL_AUTH_URL/auth/me/` for re-auth
5. Session refreshed, user can continue

**Expected:** No 401s for valid user after session refresh

### Test 22: Piston Timeout Handling

Test code that times out:

```python
# Infinite loop
while True:
    pass
```

1. Candidate submits infinite loop
2. Click "Run"
3. Should timeout after ~10s (Piston's execution limit)
4. Error message shown: "Code execution timed out"
5. No server crash

**Expected:** Graceful timeout, no impact on other candidates

### Test 23: Large Excalidraw Drawing

Test drawing > 100KB:

1. Candidate creates large drawing (complex shapes, many elements)
2. Click save
3. If Blob storage configured, should save to Vercel Blob
4. If not configured, should save to Sheets (with warning if > 5MB)

**Expected:** No data loss, drawing persists

---

## Final Checklist

Before marking Phase 7 complete:

- [ ] ISR caching works (questions, roles, screening_types)
- [ ] External auth redirects and returns user data
- [ ] RBAC enforces role-based access (admin/manager/interviewer/interviewee)
- [ ] Interviewee completes all 3 question types (text/code/system_design)
- [ ] All submissions saved to correct Sheets tabs
- [ ] Interviewer scores and submits (atomic update to responses + pipeline + screenings)
- [ ] Candidate dashboard shows all pipeline stages and scores
- [ ] External API key creation works
- [ ] External API endpoints return correct data
- [ ] API key validation rejects invalid/revoked keys
- [ ] Concurrent screenings complete without race conditions
- [ ] Performance meets thresholds (< 500ms cached, < 2s load, < 10s execution)
- [ ] Core Web Vitals are green
- [ ] No secrets exposed in client bundle
- [ ] Piston sandboxing works (no filesystem escape, code isolated per execution)
- [ ] Session expiry and refresh works
- [ ] Errors are graceful (timeouts, network failures, quota limits)

---

See also:
- [GitHub & Vercel Setup](../setup/github-vercel-setup.md)
- [Environment Variables](../setup/environment-variables.md)
- [Piston Deployment](../setup/piston-deployment.md)
- [Monitoring](./monitoring.md)
- [Phase 7: Deployment](../implementation/phase-7-deployment.md)
