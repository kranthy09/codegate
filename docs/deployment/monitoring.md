# Production Monitoring & Observability

Complete guide for setting up monitoring, logging, and observability in production on Vercel.

---

## Vercel Analytics

### Web Vitals Monitoring

**Setup:**

1. Vercel Dashboard → Project → **Settings** → **Analytics**
2. Click **Enable Analytics**
3. Re-deploy (Vercel injects analytics script)

### View Metrics

Vercel Dashboard → Project → **Analytics** → **Web Vitals**

Monitor these metrics:

| Metric | Target | What It Means |
|--------|--------|---------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Time for page's main content to load |
| **FID** (First Input Delay) | < 100ms | Response time to user interaction |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Visual stability (no unexpected layout shifts) |

**Green = Good:**
- LCP: < 2.5s (green), 2.5-4s (yellow), > 4s (red)
- FID: < 100ms (green), 100-300ms (yellow), > 300ms (red)
- CLS: < 0.1 (green), 0.1-0.25 (yellow), > 0.25 (red)

**For CodeGate:**
- ISR cached pages should hit green LCP
- Monaco and Excalidraw are heavy; monitor on slow devices
- Excalidraw might cause CLS if loaded dynamically

### Edge Function Logs

Vercel Dashboard → Project → **Logs** → **Functions**

View real-time logs from API routes:

```
2026-04-02 12:34:56.123 [GET /api/questions]
status=200 duration=45ms cache=HIT

2026-04-02 12:34:57.456 [POST /api/code-submissions]
status=200 duration=1234ms

2026-04-02 12:35:01.789 [GET /api/execute]
status=504 duration=15000ms error="Piston timeout"
```

**Filter by:**
- Route
- Status code
- Duration (slow queries)
- Error logs

---

## Google Sheets API Monitoring

### Quota Usage

**In Google Cloud Console:**
1. Project → **APIs & Services** → **Quotas**
2. Filter by **Sheets API**
3. View usage over time

**Key quotas:**
- **Reads per minute:** 600
- **Writes per minute:** 60
- **Daily quota:** 5 million

**CodeGate usage patterns:**
- Questions load: 1 read
- Screening load: ~5 reads (batch)
- Submit screening: ~10 writes (atomic)
- Load test (10 concurrent): ~100 reads/writes per second

**Monitor for:**
- Quota exhaustion (yellow > 80%, red at limit)
- Spike in API calls (indicator of runaway requests)
- Large delays (network issues)

### Sheets API Health Check

Create a simple health endpoint to verify connectivity:

```typescript
// src/app/api/health/route.ts
import { getSheetClient } from '@/lib/sheets/client'
import { RANGES } from '@/lib/sheets/client'

export async function GET() {
  try {
    const sheets = await getSheetClient()
    
    // Try to read 1 row from questions (fastest query)
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID!,
      range: `${RANGES.questions}!A1:A1`,
    })
    
    return Response.json({
      status: 'ok',
      sheets_api: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return Response.json({
      status: 'error',
      sheets_api: 'disconnected',
      error: String(error),
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}
```

**Monitor health endpoint:**
```bash
# Check every minute
* * * * * curl https://your-app.vercel.app/api/health

# Alert if not 200 OK
```

---

## Piston Monitoring

### Check Piston Health

From your Piston VPS:

```bash
# Check service is running
docker-compose -f piston/api/docker-compose.yml ps

# Check resource usage
docker stats

# View logs
docker-compose -f piston/api/docker-compose.yml logs -f api --tail 50
```

### Monitor Execution Performance

Test execution speed:

```bash
# Simple Python execution (should be < 1s)
time curl -X POST http://localhost:2000/api/v2/execute \
  -H 'Content-Type: application/json' \
  -d '{
    "language": "python",
    "version": "3.10",
    "source": "print(sum(range(1000)))"
  }'

# Slow execution (should complete < 10s, not hit timeout)
time curl -X POST http://localhost:2000/api/v2/execute \
  -H 'Content-Type: application/json' \
  -d '{
    "language": "python",
    "version": "3.10",
    "source": "import time; time.sleep(5); print(\"done\")"
  }'
```

**Expected:**
- Simple code: < 1s (most time is network + cold start)
- Complex code: < 10s (Piston timeout)
- First execution per language: 3-5s (cold boot)
- Subsequent executions: < 1s (warm)

### Piston Metrics

Piston has a stats endpoint:

```bash
curl http://your-piston:2000/api/v2/stats
# Returns execution count, runtime statistics
```

### Set Up Piston Alerts

SSH to Piston VPS and create a monitoring script:

```bash
#!/bin/bash
# /home/ubuntu/monitor-piston.sh

PISTON_URL=http://localhost:2000

check_piston_health() {
  response=$(curl -s -w "%{http_code}" -o /tmp/piston_check.txt \
    $PISTON_URL/api/v2/runtimes)
  
  if [ "$response" != "200" ]; then
    # Alert: Piston is down
    echo "ALERT: Piston health check failed with status $response"
    # Send email/Slack notification
    return 1
  fi
  
  # Check disk space
  disk_usage=$(df /var/lib/docker | tail -1 | awk '{print $5}' | sed 's/%//')
  if [ "$disk_usage" -gt 80 ]; then
    echo "ALERT: Docker disk usage is ${disk_usage}%"
  fi
  
  return 0
}

# Run every 5 minutes
while true; do
  check_piston_health
  sleep 300
done
```

Add to crontab:
```bash
crontab -e
# Add: @reboot /home/ubuntu/monitor-piston.sh &
```

---

## Error Tracking & Logging

### Vercel Error Logs

View errors in real-time:

**Vercel Dashboard → Project → Logs → Functions**

Filter for errors:

```
status=500
status=502
status=503
status=504
```

Common errors:

| Error | Likely Cause | Fix |
|-------|--------------|-----|
| 503 Service Unavailable | Sheets API quota exhausted | Wait for quota reset (daily) |
| 504 Gateway Timeout | Piston not responding | Check Piston VPS health |
| 401 Unauthorized | Session expired or invalid | User needs to re-auth |
| 403 Forbidden | Insufficient role/scope | Check RBAC rules |

### Custom Error Logging

Add error handling to critical routes:

```typescript
// src/app/api/screenings/[id]/route.ts
import { logError } from '@/lib/logger'

export async function POST(request, { params }) {
  try {
    // ... handler logic
  } catch (error) {
    await logError({
      route: '/api/screenings/[id]',
      method: 'POST',
      screening_id: params.id,
      error: String(error),
      timestamp: new Date(),
    })
    
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Third-Party Error Tracking

For production, integrate Sentry:

1. Create Sentry account (sentry.io)
2. Install Sentry SDK:
   ```bash
   npm install @sentry/nextjs
   ```
3. Initialize in middleware
4. Sentry captures all errors automatically

---

## Database & Sheets Monitoring

### Query Performance

Monitor slow Sheets API calls in logs:

```bash
# In Vercel logs, filter for duration > 2000ms
duration>2000ms

# Investigate which endpoints are slow
# Typical durations:
# - Single read: 50-200ms
# - Batch read (5 queries): 300-800ms
# - Write operation: 100-300ms
```

### Rate Limiting

Monitor API call rate:

**Google Sheets:**
- Reads per minute: 600 (10/second)
- Writes per minute: 60 (1/second)

**CodeGate load test (10 concurrent screenings):**
- Each submission: ~3-5 writes
- Total: 30-50 writes per batch
- Safe if submissions are spaced (not all at same instant)

If hitting limits:
- Implement request queuing in CodeGate
- Batch writes where possible
- Increase Sheets API quota (contact Google Cloud support)

### Data Integrity Checks

Periodic audit of Sheets data:

```bash
#!/bin/bash
# verify-data-integrity.sh

# Check for orphaned responses (response without matching screening)
# Check for duplicate submissions (same question answered twice)
# Check for missing candidate_pipeline entries (incomplete atomicity)

# Run daily:
0 2 * * * /path/to/verify-data-integrity.sh
```

---

## Alerting

### Email Alerts

Set up Vercel alerts for critical errors:

**Vercel Dashboard → Settings → Alerts**

- Alert on: deployment failures
- Alert on: error rate > 1%
- Alert on: API latency > 5s
- Notify: your-team@example.com

### Slack Integration

Connect Vercel to Slack:

1. Vercel Dashboard → Settings → **Integrations**
2. Search for **Slack**
3. Authorize and select channel
4. Get notified on deployment status, errors

Example Slack message:
```
🚨 CodeGate Production Error
Route: POST /api/screenings/submit
Status: 503 Service Unavailable
Duration: 15000ms
Error: Sheets API quota exceeded
Time: 2026-04-02 12:34:56 UTC
```

### Uptime Monitoring

Use a service like UptimeRobot:

1. Create account at uptimerobot.com
2. Add monitor: `https://your-app.vercel.app/api/health`
3. Check every 5 minutes
4. Alert via email/Slack if down

---

## Performance Monitoring

### Core Web Vitals Thresholds

Monitor in Vercel Analytics:

| Page | LCP | FID | CLS |
|------|-----|-----|-----|
| Dashboard | < 2s | < 100ms | < 0.1 |
| Question bank | < 2s | < 100ms | < 0.1 |
| Screening session | < 3s | < 100ms | < 0.15 |
| Candidate dashboard | < 2.5s | < 100ms | < 0.1 |

**If metrics degrade:**
- Check Vercel Functions logs (slow API calls)
- Check client-side bundle size
- Profile with Chrome DevTools locally

### Request Duration Monitoring

Track API latency:

```typescript
// Middleware to log request duration
export function middleware(request) {
  const start = Date.now()
  
  request.headers.set('x-request-start', start.toString())
  
  // Log at end of response (in route handler):
  const duration = Date.now() - parseInt(request.headers.get('x-request-start'))
  console.log(`${request.method} ${request.nextUrl.pathname} took ${duration}ms`)
}
```

---

## Runbooks & Incident Response

### Incident: Sheets API Quota Exhausted

**Symptoms:** 503 errors, "Quota exceeded" in logs

**Response:**
1. Check Google Cloud Console → Sheets API → Quotas
2. If > 99%, quota is exhausted
3. Wait for daily reset (UTC midnight)
4. Temporarily disable non-critical features (e.g., analytics)
5. Request quota increase from Google (takes 24-48 hours)

**Prevention:**
- Monitor quota usage daily
- Implement caching (ISR for questions, etc.)
- Batch Sheets operations where possible

### Incident: Piston Not Responding

**Symptoms:** Code executions timeout, 504 errors

**Response:**
1. SSH to Piston VPS
2. Check service: `docker-compose ps`
3. Check logs: `docker-compose logs api --tail 50`
4. If hung, restart: `docker-compose restart api`
5. If disk full, clean: `docker image prune -a`
6. If still down, redeploy Piston

**Prevention:**
- Monitor Piston health endpoint
- Set resource limits in docker-compose.yml
- Monitor disk usage, clean old images monthly

### Incident: External Auth Unavailable

**Symptoms:** 401 errors for all users, cannot login

**Response:**
1. Check `EXTERNAL_AUTH_URL` is correct
2. Verify auth service is running
3. Check network connectivity from Vercel (firewall rules)
4. If auth service is down, no workaround (plan maintenance window)

**Prevention:**
- Ensure auth service is monitored separately
- Have incident response plan for auth service
- Consider short session TTL (4h) to limit impact

### Incident: High Error Rate in Production

**Symptoms:** Vercel alert: "Error rate > 1%"

**Response:**
1. Check Vercel Logs → recent errors
2. Identify affected route(s)
3. Check if recent code change caused it
4. If recent deploy, consider rollback: Vercel Dashboard → Deployments → Rollback
5. If not recent, check external service health (Sheets, Piston, auth)

**Prevention:**
- Require tests before merging
- Use preview deployments for testing
- Monitor error rate trends (spike detection)

---

## Checklists

### Daily
- [ ] Check Vercel Analytics for Core Web Vitals (should be green)
- [ ] Review error logs in Vercel (should be < 0.1% error rate)
- [ ] Check Google Sheets API quota usage (should be < 50% of daily limit)

### Weekly
- [ ] Check Piston VPS health and disk usage
- [ ] Review slow query logs (any routes > 2s?)
- [ ] Check for any pending database migrations or schema changes

### Monthly
- [ ] Verify all environment variables are still valid
- [ ] Review and rotate API keys for external integrations
- [ ] Check SSL certificate expiry (Vercel handles this)
- [ ] Verify backups of Google Sheets (Google auto-backs up, but manual export recommended)
- [ ] Performance review: are any metrics degrading?

### Quarterly
- [ ] Load test: simulate concurrent users, verify no quota/timeout issues
- [ ] Disaster recovery test: can you restore from backups?
- [ ] Dependency updates: are there security patches?
- [ ] Capacity planning: do you need to upgrade Piston VPS?

---

## Dashboard & Tools

### Vercel Dashboard
- **Analytics:** Core Web Vitals, request rate, error rate
- **Logs:** Real-time function logs, errors
- **Deployments:** Rollback, deployment history
- **Usage:** Bandwidth, serverless function invocations

### Google Cloud Console
- **Sheets API:** Quota usage, API errors
- **IAM:** Service account permissions
- **Billing:** API costs

### Piston VPS
- **SSH access:** Monitor `docker stats`, logs
- **Monitoring script:** CPU, memory, disk usage

### External (Optional)
- **Sentry:** Error tracking and alerting
- **UptimeRobot:** Uptime monitoring
- **Slack/PagerDuty:** Incident notifications

---

See also:
- [Verification & Testing](./verification.md)
- [GitHub & Vercel Setup](../setup/github-vercel-setup.md)
- [Piston Deployment](../setup/piston-deployment.md)
- [Phase 7: Deployment](../implementation/phase-7-deployment.md)
