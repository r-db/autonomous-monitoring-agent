# Autonomous Monitoring Agent - Deployment Guide

**Week 1 Backend Foundation**
**Created:** November 4, 2025

---

## Overview

This guide provides step-by-step instructions to deploy the Autonomous Monitoring Agent backend foundation to Railway and Supabase.

---

## Prerequisites

- Railway account with CLI installed
- Supabase project with database access
- Node.js 18+ installed locally
- Git repository set up

---

## Step 1: Install Dependencies

```bash
cd /Users/riscentrdb/Desktop/autonomous-agent
npm install
```

**Expected output:**
- All 6 dependencies installed successfully
- No vulnerabilities or warnings

---

## Step 2: Set Up Supabase Database

### 2.1 Run Migration

1. Open Supabase SQL Editor: https://app.supabase.com/project/YOUR_PROJECT/sql
2. Copy contents of `migrations/001_create_tables.sql`
3. Paste into SQL Editor
4. Click "Run"

**Expected output:**
```
✅ All 8 tables created successfully
✅ System configuration seeded (9 entries)
```

### 2.2 Verify Tables

Run this query in Supabase SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'error_knowledge',
  'incidents',
  'monitoring_checks',
  'agent_actions',
  'deployment_history',
  'security_events',
  'system_config',
  'email_tracking'
)
ORDER BY table_name;
```

**Expected result:** 8 rows returned

### 2.3 Verify System Config

```sql
SELECT key, value->>'enabled' as enabled, value->>'value' as value
FROM system_config
ORDER BY key;
```

**Expected result:** 9 rows with configuration values

---

## Step 3: Configure Environment Variables

### 3.1 Get Supabase Credentials

1. Go to Supabase Project Settings > API
2. Copy:
   - Project URL (e.g., `https://abc123.supabase.co`)
   - Anon/Public Key (starts with `eyJ...`)

### 3.2 Get Database Connection String

1. Go to Supabase Project Settings > Database
2. Copy Connection String (Pooling mode)
3. Should look like: `postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres`

---

## Step 4: Deploy to Railway

### 4.1 Initialize Railway Project

```bash
cd /Users/riscentrdb/Desktop/autonomous-agent

# Login to Railway
railway login

# Create new project
railway init

# Follow prompts:
# - Project name: autonomous-monitoring-agent
# - Start with empty project: Yes
```

### 4.2 Set Environment Variables

```bash
# Set Supabase URL
railway variables set SUPABASE_URL="https://YOUR_PROJECT.supabase.co"

# Set Supabase Key
railway variables set SUPABASE_ANON_KEY="eyJhbG..."

# Set Database URL (for direct connection)
railway variables set DATABASE_URL="postgresql://postgres..."

# Set Node environment
railway variables set NODE_ENV="production"

# Set port (Railway auto-assigns)
railway variables set PORT="3000"

# Set application URLs
railway variables set ADMIN_CONSOLE_URL="https://admin-console-production.vercel.app"
railway variables set BACKEND_API_URL="https://inboundai365-backend-production.up.railway.app"
```

### 4.3 Deploy

```bash
railway up
```

**Expected output:**
- Build starts
- Dependencies installed
- Service deployed
- URL assigned (e.g., `https://autonomous-monitoring-agent-production.up.railway.app`)

### 4.4 Monitor Deployment

```bash
# Watch logs
railway logs

# Expected log output:
# ========================================
# 🚀 Autonomous Monitoring Agent
# ========================================
# Environment: production
# Port: 3000
# Started: 2025-11-04T...
# ========================================
#
# [STARTUP] Testing database connection...
# [DATABASE] Connection successful
# [STARTUP] Starting monitoring services...
# [CRON] Starting monitoring cron jobs...
# [CRON] Health check cron scheduled (every minute)
#
# ✅ Service ready and operational
```

---

## Step 5: Verify Deployment

### 5.1 Test Health Endpoint

```bash
# Replace with your Railway URL
RAILWAY_URL="https://your-service.railway.app"

curl $RAILWAY_URL/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-04T...",
  "uptime": 12.345,
  "memory": {...},
  "database": "connected"
}
```

### 5.2 Test Root Endpoint

```bash
curl $RAILWAY_URL/
```

**Expected response:**
```json
{
  "service": "Autonomous Monitoring Agent",
  "version": "1.0.0-week1",
  "status": "operational",
  "timestamp": "2025-11-04T...",
  "endpoints": {
    "health": "/health",
    "status": "/status",
    "error_reporting": "/api/autonomous/error",
    "incidents": "/api/autonomous/incidents"
  }
}
```

### 5.3 Test Error Reporting Endpoint

```bash
curl -X POST $RAILWAY_URL/api/autonomous/error \
  -H "Content-Type: application/json" \
  -d '{
    "error": {
      "message": "Test error from deployment verification",
      "type": "TestError",
      "stack": "Error: Test\n    at test.js:10:5"
    },
    "context": {
      "application": "test",
      "endpoint": "/test"
    },
    "severity": "LOW",
    "source": "deployment_test"
  }'
```

**Expected response:**
```json
{
  "incident_id": "INC-...",
  "created": true,
  "severity": "LOW",
  "category": "backend",
  "status": "detected",
  "timestamp": "2025-11-04T..."
}
```

### 5.4 Verify Database Writes

In Supabase SQL Editor:

```sql
-- Check for test incident
SELECT incident_id, severity, error_message, detected_at
FROM incidents
ORDER BY detected_at DESC
LIMIT 5;
```

**Expected:** At least 1 row with your test error

```sql
-- Check monitoring checks (should have entries after 1-2 minutes)
SELECT check_id, application, status, response_time_ms, timestamp
FROM monitoring_checks
ORDER BY timestamp DESC
LIMIT 10;
```

**Expected:** Rows appearing every minute with health check results

```sql
-- Check agent actions
SELECT agent_id, action_type, action_description, timestamp
FROM agent_actions
ORDER BY timestamp DESC
LIMIT 10;
```

**Expected:** Multiple rows including:
- `service_startup`
- `monitoring_started`
- `error_detected`
- `health_check_failure` (if any checks failed)

---

## Step 6: Verify Cron Jobs

### 6.1 Wait 2 Minutes

Health checks run every 60 seconds. Wait at least 2 minutes after deployment.

### 6.2 Check Railway Logs

```bash
railway logs --tail 50
```

**Look for:**
- `[HEALTH CHECK] Starting health checks...`
- `[HEALTH CHECK OK] backend - XXms`
- `[HEALTH CHECK OK] frontend - XXms`
- `[HEALTH CHECK OK] database - XXms`
- `[HEALTH CHECK] Completed`

### 6.3 Verify in Database

```sql
-- Count checks in last 5 minutes
SELECT COUNT(*) as check_count
FROM monitoring_checks
WHERE timestamp > NOW() - INTERVAL '5 minutes';
```

**Expected:** 3-5 checks per minute × 5 minutes = 15-25 total checks

```sql
-- Check interval consistency
SELECT
  timestamp,
  LAG(timestamp) OVER (ORDER BY timestamp) as prev,
  EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp))) as seconds_diff
FROM monitoring_checks
WHERE check_type = 'health'
ORDER BY timestamp DESC
LIMIT 10;
```

**Expected:** `seconds_diff` should be around 60 seconds (±5 seconds)

---

## Step 7: Performance Verification

### 7.1 Check Response Times

```sql
SELECT
  application,
  AVG(response_time_ms) as avg_response_time,
  MAX(response_time_ms) as max_response_time,
  COUNT(*) as check_count
FROM monitoring_checks
WHERE timestamp > NOW() - INTERVAL '10 minutes'
GROUP BY application;
```

**Expected:**
- Average response time < 2000ms
- Max response time < 5000ms

### 7.2 Check Service Uptime

In Railway Dashboard:
- Go to your service
- Check "Metrics" tab
- Verify uptime > 99%

### 7.3 Check Memory Usage

```bash
railway logs --tail 20 | grep memory
```

**Expected:** Memory usage stable, not growing continuously

---

## Acceptance Criteria Checklist

### Deployment ✅
- [ ] Railway service deployed successfully
- [ ] Service accessible via public URL
- [ ] All 8 database tables created
- [ ] Environment variables configured
- [ ] Health endpoint returns 200

### Functionality ✅
- [ ] Error reporting endpoint accepts POST requests
- [ ] Incidents created in database within 100ms
- [ ] Errors classified correctly (severity + category)
- [ ] Health checks run every 60 seconds
- [ ] All actions logged to agent_actions table

### Performance ✅
- [ ] Error detection latency < 60 seconds
- [ ] Database writes < 100ms
- [ ] Health check response times < 5 seconds
- [ ] Service uptime > 99.5%
- [ ] No memory leaks detected

### Monitoring ✅
- [ ] Cron jobs running on schedule
- [ ] Railway logs showing health checks
- [ ] Database showing consistent check intervals
- [ ] Failed health checks create incidents

---

## Troubleshooting

### Issue: Database Connection Failed

**Symptoms:**
```
[DATABASE] Connection test failed: connection timeout
```

**Solution:**
1. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
2. Check Supabase project is active (not paused)
3. Verify IP allowlist in Supabase (Railway IPs should be allowed)

### Issue: Cron Jobs Not Running

**Symptoms:**
- No health check logs
- No rows in `monitoring_checks` table

**Solution:**
1. Check Railway logs for errors
2. Verify service didn't crash (check Railway dashboard)
3. Restart service: `railway restart`

### Issue: Health Checks Failing

**Symptoms:**
```
[HEALTH CHECK FAILED] backend - Status: 502
```

**Solution:**
1. Verify `BACKEND_API_URL` and `ADMIN_CONSOLE_URL` are correct
2. Test URLs manually with curl
3. Check if target services are running

### Issue: High Memory Usage

**Symptoms:**
- Memory usage increasing continuously
- Service restarting frequently

**Solution:**
1. Check for memory leaks in cron jobs
2. Verify database connections are being closed
3. Increase Railway service memory allocation

---

## Next Steps (Week 2)

After successful deployment:

1. **Monitor for 24 hours** - Ensure system stability
2. **Review incidents** - Check for any false positives
3. **Begin Week 2** - RAG knowledge base implementation
4. **Set up Sentry** - Real-time error reporting integration

---

## Support

**Questions or Issues?**
- Check Railway logs: `railway logs`
- Check Supabase logs: Supabase Dashboard > Logs
- Review this guide
- Contact: PM Coordinator

---

**Deployment Status:** ✅ Ready for Production
**Last Updated:** November 4, 2025
