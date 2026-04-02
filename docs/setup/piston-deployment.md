# Piston Code Execution Deployment

Piston is a self-hosted code execution service used by CodeGate to run user-submitted code in isolated sandboxes. It must run on a separate VPS/container — not on Vercel.

## Quick Start: Self-Hosted VPS (Recommended for Production)

### Prerequisites
- Linux VPS with Docker and Docker Compose (Ubuntu 20.04+)
- 2+ CPU cores, 4GB RAM minimum
- Public IP or domain name
- Network: allow port 2000 inbound (from Vercel IP ranges or reverse proxy)

### 1. Deploy Piston

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Clone Piston repository
git clone https://github.com/engineer-man/piston
cd piston/api

# Start Piston service
docker-compose up -d

# Verify it's running
curl http://localhost:2000/api/v2/runtimes
```

### 2. Install Language Runtimes

Piston comes with a package manager. Install languages needed by your interviewers:

```bash
# Check available languages
curl -s http://localhost:2000/api/v2/runtimes | jq '.[]'

# Install specific runtimes (examples)
curl -X POST http://localhost:2000/api/v2/packages \
  -H 'Content-Type: application/json' \
  -d '{"language": "python", "version": "3.10"}'

curl -X POST http://localhost:2000/api/v2/packages \
  -H 'Content-Type: application/json' \
  -d '{"language": "javascript", "version": "18.20.0"}'

curl -X POST http://localhost:2000/api/v2/packages \
  -H 'Content-Type: application/json' \
  -d '{"language": "java", "version": "21.0.1"}'

curl -X POST http://localhost:2000/api/v2/packages \
  -H 'Content-Type: application/json' \
  -d '{"language": "go", "version": "1.21.0"}'

curl -X POST http://localhost:2000/api/v2/packages \
  -H 'Content-Type: application/json' \
  -d '{"language": "cpp", "version": "11.2.0"}'

curl -X POST http://localhost:2000/api/v2/packages \
  -H 'Content-Type: application/json' \
  -d '{"language": "rust", "version": "1.70.0"}'
```

### 3. Reverse Proxy (Optional but Recommended)

Expose Piston behind a reverse proxy (nginx) with:
- TLS/HTTPS termination
- Authentication header validation
- Rate limiting

```nginx
# /etc/nginx/sites-available/piston
upstream piston_backend {
    server localhost:2000;
}

server {
    listen 443 ssl http2;
    server_name piston.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/piston.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/piston.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://piston_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Require secret header from Vercel
        if ($http_x_piston_secret != "your-secret-key") {
            return 403;
        }
    }
}

server {
    listen 80;
    server_name piston.your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

Enable and start:
```bash
sudo ln -s /etc/nginx/sites-available/piston /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

### 4. Configure CodeGate to Use Your Piston

In Vercel dashboard, set:
```
CODE_EXECUTION_URL=http://your-vps-ip:2000
# OR if using reverse proxy:
CODE_EXECUTION_URL=https://piston.your-domain.com
X_PISTON_SECRET=your-secret-key  (if reverse proxy auth is enabled)
```

### 5. Monitor Piston Health

Check service status:
```bash
# SSH to VPS
docker-compose -f piston/api/docker-compose.yml ps

# View logs
docker-compose -f piston/api/docker-compose.yml logs -f

# Check resource usage
docker stats

# Test execution (simple request)
curl -X POST http://localhost:2000/api/v2/execute \
  -H 'Content-Type: application/json' \
  -d '{
    "language": "python",
    "version": "3.10",
    "source": "print(\"Hello, World!\")"
  }'
```

---

## Alternative: Public emkc.org Endpoint (Dev/Testing Only)

For development or low-traffic testing, use the public Piston instance:

```bash
# In Vercel dashboard, set:
CODE_EXECUTION_URL=https://emkc.org
```

**⚠️ Limitations:**
- Rate limited (shared with all users)
- No uptime SLA
- Not suitable for production with concurrent users
- Latency may be high

---

## Piston Security Hardening

### Firewall Configuration
Allow inbound connections only from Vercel:

```bash
# Whitelist Vercel IP ranges (https://vercel.com/docs/concepts/edge-network/regions)
sudo ufw allow from 76.76.19.0/24 to any port 2000
sudo ufw allow from 76.76.20.0/24 to any port 2000

# Or restrict all other traffic
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

### Network Isolation
- Piston containers cannot access external networks (sandboxed)
- No file persistence between executions
- Memory/CPU limits per execution (configurable in docker-compose.yml)

### Piston Configuration (docker-compose.yml overrides)

```yaml
# piston/api/docker-compose.yml overrides
services:
  api:
    environment:
      PISTON_RUNTIME_TIMEOUT: 10000  # 10 second timeout
      PISTON_OUTPUT_MAX_SIZE: 1000000  # 1MB max output
      PISTON_MEMORY_LIMIT: 256M  # Per-execution memory limit
```

---

## Troubleshooting

### Code execution times out
- Increase `maxDuration` in [vercel.json](../../vercel.json) (currently 15s)
- Check Piston VPS CPU/memory: `docker stats`
- May need to upgrade VPS or pre-warm runtimes

### Piston not responding
```bash
# Check service is running
docker-compose ps

# Restart if stuck
docker-compose restart api

# Check logs for errors
docker-compose logs api --tail 100
```

### Rate limiting issues
- Monitor usage at `CODE_EXECUTION_URL/api/v2/stats`
- Self-hosted Piston has no rate limits; public emkc.org does
- Consider implementing request queuing in CodeGate API route

### High latency
- Measure: `curl -w "Total: %{time_total}s\n" CODE_EXECUTION_URL/api/v2/runtimes`
- Self-hosted Piston should be < 500ms latency (VPS same region as Vercel)
- Cold boots can take 3-5s (subsequent runs < 1s)

---

## Integration Testing

Once deployed, test the full flow from CodeGate:

1. **Admin creates a code question** in question bank
2. **Candidate takes screening** → navigates to code question
3. **Monaco editor** loads with starter code
4. **Click "Run"** → CodeGate calls `/api/execute`
5. **Check response** → code output appears in console
6. **Submit** → code saved to Sheets with execution result

```bash
# Manual integration test
curl -X POST https://your-app.vercel.app/api/execute \
  -H 'Authorization: Bearer <session_token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "language": "python",
    "version": "3.10",
    "source": "print(42)"
  }'
```

---

## Maintenance

### Regular Tasks
- Monitor disk usage: `df -h`
- Clean unused Docker images: `docker image prune -a`
- Rotate logs: ensure `/var/log/docker/` doesn't fill disk
- Update Piston monthly: `git pull && docker-compose up -d`

### Scaling
- **Single VPS**: handles ~10 concurrent code executions comfortably
- **High traffic**: consider load balancer + multiple Piston instances + shared cache
- **Cold boots**: pre-pull runtimes in a startup script to reduce latency

---

See also: [Phase 7: Deployment](../implementation/phase-7-deployment.md)
