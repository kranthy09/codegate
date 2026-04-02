# GitHub & Vercel Deployment Setup

This guide covers pushing CodeGate to GitHub and connecting it to Vercel for production deployment.

## Step 1: Prepare GitHub Repository

### 1.1 Create GitHub Repository

```bash
# Create a new public or private repository on GitHub
# Name: codegate
# Initialize with: No (we already have a local repo)
```

### 1.2 Add GitHub Remote to Local Repository

```bash
# In your local codegate directory
cd /path/to/codegate

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/codegate.git

# Verify
git remote -v
# origin  https://github.com/YOUR_USERNAME/codegate.git (fetch)
# origin  https://github.com/YOUR_USERNAME/codegate.git (push)

# Set default branch to main (if not already set)
git branch -M main
```

### 1.3 Review .gitignore

Ensure sensitive files are not committed:

```bash
# Check what's ignored
cat .gitignore
```

Should exclude:
- `.env`, `.env.local`, `.env.*.local` (credentials)
- `node_modules/`
- `.next/` (build artifacts)
- `*.log` (logs)

Verify with:
```bash
# Check what would be pushed
git status
```

You should see:
- `.env.example` ✓ (committed, no secrets)
- `.env.local` ✗ (ignored, never committed)
- `.gitignore` ✓ (committed)

### 1.4 Push to GitHub

```bash
# Stage all changes (you've already reviewed what's staged)
git add -A

# Create initial commit if needed
git commit -m "Initial CodeGate deployment setup"

# Push to GitHub
git push -u origin main
```

Verify on GitHub.com that your code appears.

---

## Step 2: Connect to Vercel

### 2.1 Create Vercel Account & Project

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub (easier for integration)
3. Click **"New Project"**
4. Select **Import Git Repository**
5. Authorize GitHub when prompted
6. Search for "codegate" repository
7. Click **Import**

### 2.2 Configure Project Name

- **Project Name:** `codegate`
- **Framework Preset:** Next.js (auto-detected)
- **Root Directory:** `./` (default)

Click **Continue**.

### 2.3 Set Environment Variables

This is critical. Vercel will use these during builds and runtime.

**In Vercel Dashboard:**
1. Go to Project → **Settings** → **Environment Variables**
2. Add all variables from `.env.example` (see [environment-variables.md](./environment-variables.md) for details)

```
GOOGLE_SERVICE_ACCOUNT_EMAIL     = codegate-service@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY               = -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
GOOGLE_SHEET_ID                  = your_sheet_id
SESSION_SECRET                   = (unique random secret per environment)
EXTERNAL_AUTH_URL                = https://your-auth-service.example.com
CODE_EXECUTION_URL               = https://your-piston-url.com (or https://emkc.org for dev)
BLOB_READ_WRITE_TOKEN            = (optional, for large Excalidraw drawings)
```

**⚠️ Important:**
- Use **different** `GOOGLE_SHEET_ID` per environment (production vs. preview)
- Generate **unique** `SESSION_SECRET` for each environment
- Mark sensitive variables as **secret** (not revealed in logs)

### 2.4 Configure Environment for Each Stage

In **Settings → Environment Variables**, for each variable, select which environments:

| Variable | Production | Preview | Development |
|----------|-----------|---------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ✓ | ✓ | ✓ |
| `GOOGLE_PRIVATE_KEY` | ✓ | ✓ | ✓ |
| `GOOGLE_SHEET_ID` | prod sheet | staging sheet | dev sheet |
| `SESSION_SECRET` | unique | unique | unique |
| `EXTERNAL_AUTH_URL` | prod | staging | local |
| `CODE_EXECUTION_URL` | self-hosted | self-hosted/emkc | emkc |

### 2.5 Deploy

Click **Deploy** and wait for build to complete.

- Vercel runs `npm install` and `npm run build`
- Next.js compiles and optimizes
- Deployment takes ~2-5 minutes
- You get a preview URL (e.g., `https://codegate-abc123.vercel.app`)

Check logs if the build fails (usually missing env vars or TypeScript errors).

---

## Step 3: Verify Deployment

Once deployed to Vercel, test critical flows:

### 3.1 Health Check

```bash
# Replace YOUR_VERCEL_APP with your app URL
curl -I https://your-app.vercel.app/api/roles
# Should return: 200 OK (ISR cached response)
```

### 3.2 Auth Flow

1. Navigate to `https://your-app.vercel.app/`
2. Should redirect to `EXTERNAL_AUTH_URL/auth/me/`
3. After auth, should land on `/dashboard` or candidate session
4. Check browser cookies for `cg_session` (internal JWT)

### 3.3 Full Screening Flow Test

1. Create a candidate + screening in Google Sheets
2. Get interviewee link: `/session/[screening-id]`
3. Complete text question → verify saved to `responses` sheet
4. Complete code question → run code → verify saved to `code_submissions`
5. Complete design question → draw → verify saved to `drawings`
6. Submit screening → verify `candidate_pipeline` snapshot created

See [verification.md](../deployment/verification.md) for full test checklist.

---

## Step 4: Set Up Continuous Deployment

### 4.1 GitHub Integration (Auto)

Vercel automatically:
- Watches `main` branch for pushes
- Builds and deploys automatically
- Creates preview URLs for pull requests
- Prevents merge until checks pass (optional)

No additional setup needed.

### 4.2 Rollback

If a deployment fails:

```bash
# Vercel dashboard: Project → Deployments → find bad deployment → click "Rollback"
```

Or revert and push to GitHub:

```bash
git revert HEAD~1  # Undo the bad commit
git push origin main
# Vercel auto-rebuilds from new commit
```

---

## Step 5: Set Up Deployment Protection

To prevent accidental production deployments:

**In Vercel Dashboard:**
1. **Settings** → **Git** → **Deploy on Push**
   - Ensure `main` branch automatically deploys to Production
2. **Settings** → **Protection** → **Production Deployment**
   - (Optional) Require approval before production deploys
   - (Optional) Restrict who can deploy

---

## Step 6: Configure Custom Domain (Optional)

To deploy to your own domain instead of `vercel.app`:

**In Vercel Dashboard:**
1. **Settings** → **Domains**
2. Add your domain (e.g., `codegate.company.com`)
3. Vercel shows DNS records to configure at your domain registrar
4. Once DNS propagates, HTTPS is auto-enabled

---

## Step 7: Set Up Analytics & Monitoring

**In Vercel Dashboard:**
1. **Analytics** → Enable for Core Web Vitals tracking
2. **Logs** → Real-time function invocation logs
3. **Usage** → Monitor Serverless Function executions and bandwidth

See [monitoring.md](../deployment/monitoring.md) for detailed setup.

---

## Troubleshooting

### Build Fails: "Cannot find module 'googleapis'"

**Cause:** `serverExternalPackages` not set in `next.config.ts`  
**Fix:** Check [next.config.ts](../../next.config.ts) has:
```typescript
serverExternalPackages: ['googleapis']
```

### Build Fails: TypeScript Errors

**Cause:** Strict mode or missing types  
**Fix:**
```bash
# Locally run the same build
npm run build

# Fix errors, push again
git push origin main
```

### Deployment Succeeds but Auth Fails

**Cause:** `EXTERNAL_AUTH_URL` not reachable from Vercel  
**Fix:**
1. Ensure auth service allows Vercel IP ranges
2. Check `EXTERNAL_AUTH_URL` is correct (no trailing slash)
3. Test from Vercel Function logs (Vercel Dashboard → Logs)

### Code Execution Times Out

**Cause:** Piston not reachable or slow  
**Fix:**
1. Check `CODE_EXECUTION_URL` is correct
2. Verify Piston VPS is running: `curl CODE_EXECUTION_URL/api/v2/runtimes`
3. Increase timeout in [vercel.json](../../vercel.json):
   ```json
   { "functions": { "src/app/api/execute/route.ts": { "maxDuration": 20 } } }
   ```

---

## Next Steps

1. Run full test suite: see [verification.md](../deployment/verification.md)
2. Set up monitoring: see [monitoring.md](../deployment/monitoring.md)
3. Load test with concurrent candidates
4. Document any custom configurations for your team

---

See also:
- [Phase 7: Deployment](../implementation/phase-7-deployment.md)
- [Piston Code Execution](./piston-deployment.md)
- [Environment Variables](./environment-variables.md)
