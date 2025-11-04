# AUTONOMOUS MONITORING AGENT - DEPLOYMENT INSTRUCTIONS

**Status:** Ready for deployment
**Date:** November 4, 2025
**Opus Score:** 88/100 (Production-ready)

---

## PRODUCTION API KEY

**Generated:** `74eaceebf3698d602f007123e8960c927fc00c3dce67a9c212170f020d72769b`

**IMPORTANT:** Store this securely. This is the production API key for authentication.

---

## DEPLOYMENT STEPS

### Step 1: Database Setup (Supabase)

1. Log into Supabase: https://supabase.com/dashboard
2. Navigate to your project's SQL Editor
3. Copy the entire contents of `migrations/001_create_tables.sql`
4. Paste into SQL Editor
5. Click "Run"
6. Verify: Should see "Success. No rows returned" (8 tables created)

**Verification Query:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected output: 8 tables (agent_actions, deployment_history, email_tracking, error_knowledge, incidents, monitoring_checks, security_events, system_config)

---

### Step 2: Railway Environment Variables

1. Log into Railway: https://railway.app
2. Create new project or select existing
3. Add service from GitHub repo or local directory
4. Set environment variables:

**Required Variables:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here
API_KEY=74eaceebf3698d602f007123e8960c927fc00c3dce67a9c212170f020d72769b
ALLOWED_ORIGINS=https://admin.ib365.ai,https://demo.ib365.ai
ADMIN_CONSOLE_URL=https://admin.ib365.ai
NODE_ENV=production
PORT=3000
```

**Where to find values:**
- SUPABASE_URL: Supabase Dashboard > Settings > API > Project URL
- SUPABASE_ANON_KEY: Supabase Dashboard > Settings > API > Project API keys > anon/public
- API_KEY: Use generated key above
- ALLOWED_ORIGINS: Your admin console URLs (comma-separated)
- ADMIN_CONSOLE_URL: Your main admin console URL

---

### Step 3: Deploy to Railway

**Option A: From Local Directory**
```bash
cd /Users/riscentrdb/Desktop/autonomous-agent
railway login
railway init
railway up
```

**Option B: From GitHub**
1. Push code to GitHub repo
2. Railway Dashboard > New Project > Deploy from GitHub
3. Select repository
4. Railway auto-detects Node.js and deploys

---

### Step 4: Verify Deployment

Once deployed, Railway will provide a URL (e.g., `https://your-service.up.railway.app`)

**Test 1: Health Check (No Auth Required)**
```bash
curl https://your-service.up.railway.app/health
```
Expected: `{"status":"healthy",...}`

**Test 2: Authenticated Endpoint (With API Key)**
```bash
curl -H "x-api-key: 74eaceebf3698d602f007123e8960c927fc00c3dce67a9c212170f020d72769b" \
     https://your-service.up.railway.app/api/autonomous/trigger
```
Expected: `{"success":true,"message":"All monitoring checks triggered successfully",...}`

**Test 3: Unauthorized Access (Should Fail)**
```bash
curl https://your-service.up.railway.app/api/autonomous/trigger
```
Expected: `{"error":"Unauthorized","message":"API key required in x-api-key header"}`

---

### Step 5: Monitor Logs

**View Railway Logs:**
```bash
railway logs --tail 100
```

**Look for:**
- `[ENV] Environment variables validated successfully`
- `[STARTUP] Monitoring service starting...`
- `✅ Database connection successful`
- `[CRON] Health check monitoring scheduled (every 60 seconds)`
- `[CRON] Browser monitoring scheduled (every 5 minutes)`
- `[CRON] Security scanning scheduled (every 10 minutes)`
- `🚀 Autonomous Monitoring Agent running on port 3000`

---

## POST-DEPLOYMENT VERIFICATION

### Check Database Activity

Log into Supabase SQL Editor and run:

```sql
-- Check monitoring checks (should have entries every 60 seconds)
SELECT COUNT(*), MAX(checked_at) as last_check 
FROM monitoring_checks;

-- Check incidents (may be empty initially)
SELECT COUNT(*) FROM incidents;

-- Check agent actions (should have startup actions)
SELECT * FROM agent_actions 
ORDER BY action_timestamp DESC 
LIMIT 10;

-- Check system config
SELECT * FROM system_config;
```

---

## PRODUCTION URLs

Once deployed, update these in your documentation:

- **Service URL:** `https://your-service.up.railway.app`
- **Health Check:** `https://your-service.up.railway.app/health`
- **Status:** `https://your-service.up.railway.app/status`
- **API Base:** `https://your-service.up.railway.app/api/autonomous`

---

## SECURITY NOTES

1. **API Key Security:**
   - Never commit API key to git
   - Store in Railway environment variables only
   - Rotate if compromised

2. **CORS:**
   - Only specified origins in ALLOWED_ORIGINS can access
   - Update ALLOWED_ORIGINS if adding new domains

3. **Rate Limiting:**
   - 100 requests per 15 minutes (general)
   - 50 requests per 5 minutes (error creation)
   - 5 requests per 1 minute (manual triggers)

4. **Monitoring:**
   - Check Railway logs daily for anomalies
   - Monitor Supabase for unusual query patterns
   - Review security_events table weekly

---

## TROUBLESHOOTING

### Service Won't Start
- Check Railway logs for errors
- Verify all environment variables set
- Ensure SUPABASE_URL is valid URL format
- Check API_KEY is at least 32 characters

### Database Connection Failed
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Check Supabase project is active (not paused)
- Verify database tables exist

### Authentication Not Working
- Verify API_KEY environment variable matches what you're sending
- Check x-api-key header format (lowercase, with hyphens)
- Ensure no extra spaces in API key

### Monitoring Not Running
- Check Railway logs for cron job messages
- Verify no errors in browser monitoring (requires Playwright)
- Check database for monitoring_checks entries

---

## NEXT STEPS (Week 2)

Once Week 1 is verified working in production:

1. **Week 2: RAG Knowledge Base**
   - OpenAI embeddings for error similarity
   - Vector search with pgvector
   - Smart error matching

2. **Monitor Production**
   - Watch for incidents in database
   - Review monitoring_checks regularly
   - Check security_events for anomalies

3. **Iterate & Improve**
   - Fine-tune security scanner thresholds
   - Adjust monitoring frequencies if needed
   - Add more pages to Playwright monitoring

---

## SUPPORT

**Documentation:**
- Full README: `/Users/riscentrdb/Desktop/autonomous-agent/README.md`
- Deployment Guide: `/Users/riscentrdb/Desktop/autonomous-agent/DEPLOYMENT_GUIDE.md`
- Week 1 Final Report: `/Users/riscentrdb/Desktop/liaison/WEEK_1_FINAL_REPORT.md`

**Code Location:**
- Local: `/Users/riscentrdb/Desktop/autonomous-agent/`
- Git: Committed to main branch

**Contact:**
- Team Liaison for deployment questions
- Opus 4.1 evaluation reports for technical details

---

**DEPLOYMENT READY** ✅

Follow steps 1-5 above to deploy to production.
