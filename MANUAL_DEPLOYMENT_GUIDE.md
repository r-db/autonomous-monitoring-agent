# MANUAL DEPLOYMENT GUIDE - AUTONOMOUS MONITORING AGENT

**Status:** Ready for immediate deployment
**Date:** November 4, 2025
**Prerequisites:** ✅ All complete

---

## DEPLOYMENT OPTIONS

### Option 1: Railway CLI (Recommended)

**Step 1: Install Railway CLI (if needed)**
```bash
npm install -g @railway/cli
# or
brew install railway
```

**Step 2: Authenticate**
```bash
railway login
# Opens browser for authentication
```

**Step 3: Initialize Project**
```bash
cd /Users/riscentrdb/Desktop/autonomous-agent
railway init
# Select "Create new project"
# Name: autonomous-monitoring-agent
```

**Step 4: Set Environment Variables**
```bash
railway variables set SUPABASE_URL="https://zstqmlhhpxatbhvsfrvd.supabase.co"
railway variables set SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzdHFtbGhocHhhdGJodnNmcnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc1NjU4NzgsImV4cCI6MjA0MzE0MTg3OH0.4e5Jv4-_G8sTmWIb-rSBn5BcUqj6wU7VqTi4N5eHhBs"
railway variables set API_KEY="74eaceebf3698d602f007123e8960c927fc00c3dce67a9c212170f020d72769b"
railway variables set ALLOWED_ORIGINS="https://admin.ib365.ai,https://demo.ib365.ai"
railway variables set ADMIN_CONSOLE_URL="https://admin.ib365.ai"
railway variables set NODE_ENV="production"
```

**Step 5: Deploy**
```bash
railway up
```

**Step 6: Get URL**
```bash
railway status
# Copy the deployment URL
```

**Step 7: Verify**
```bash
# Replace YOUR-URL with actual Railway URL
curl https://YOUR-URL.railway.app/health
```

---

### Option 2: Railway Dashboard (Web UI)

**Step 1: Deploy Database First**

1. Go to Supabase: https://supabase.com/dashboard
2. Open project: zstqmlhhpxatbhvsfrvd
3. Go to SQL Editor
4. Copy contents of `/Users/riscentrdb/Desktop/autonomous-agent/migrations/001_create_tables.sql`
5. Paste and click "Run"
6. Verify 8 tables created:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```

**Step 2: Create Railway Project**

1. Go to Railway: https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo" OR "Empty Project"
4. Name: autonomous-monitoring-agent

**Step 3: Add Service**

If using GitHub:
- Connect GitHub account
- Select repository
- Railway auto-detects Node.js

If using Empty Project:
- Click "New Service"
- Select "Empty Service"
- Will need to push code via Railway CLI

**Step 4: Set Environment Variables**

In Railway Dashboard > Your Project > Variables:
```
SUPABASE_URL=https://zstqmlhhpxatbhvsfrvd.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzdHFtbGhocHhhdGJodnNmcnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc1NjU4NzgsImV4cCI6MjA0MzE0MTg3OH0.4e5Jv4-_G8sTmWIb-rSBn5BcUqj6wU7VqTi4N5eHhBs
API_KEY=74eaceebf3698d602f007123e8960c927fc00c3dce67a9c212170f020d72769b
ALLOWED_ORIGINS=https://admin.ib365.ai,https://demo.ib365.ai
ADMIN_CONSOLE_URL=https://admin.ib365.ai
NODE_ENV=production
PORT=3000
```

**Step 5: Deploy**

- If GitHub: Push to main branch, Railway auto-deploys
- If Empty: Use Railway CLI to push code

**Step 6: Monitor Deployment**

- Watch logs in Railway Dashboard
- Wait for "Deployed" status
- Copy service URL

**Step 7: Verify**

```bash
# Test health (no auth required)
curl https://YOUR-SERVICE.railway.app/health

# Test auth (should fail without key)
curl https://YOUR-SERVICE.railway.app/api/autonomous/trigger

# Test with key (should succeed)
curl -H "x-api-key: 74eaceebf3698d602f007123e8960c927fc00c3dce67a9c212170f020d72769b" \
     https://YOUR-SERVICE.railway.app/api/autonomous/trigger
```

---

### Option 3: Vercel (Alternative)

**Note:** Code is currently configured for Railway. To deploy on Vercel, need to modify for serverless functions.

**Not recommended for this project** (requires refactoring for serverless)

---

## POST-DEPLOYMENT CHECKLIST

### ✅ Verify Deployment

**1. Health Check**
```bash
curl https://YOUR-URL/health
```
Expected: `{"status":"healthy",...}`

**2. Authentication Working**
```bash
# Without key (should fail)
curl https://YOUR-URL/api/autonomous/trigger
# Expected: 401 Unauthorized

# With key (should succeed)
curl -H "x-api-key: 74eaceebf3698d602f007123e8960c927fc00c3dce67a9c212170f020d72769b" \
     https://YOUR-URL/api/autonomous/trigger
# Expected: 200 Success
```

**3. Database Connected**
```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) FROM monitoring_checks;
-- Should have entries after 2-3 minutes
```

**4. Cron Jobs Running**

Check Railway logs:
```bash
railway logs --tail 50
```

Look for:
- `[CRON] Health check monitoring scheduled`
- `[CRON] Browser monitoring scheduled`
- `[CRON] Security scanning scheduled`

---

## TROUBLESHOOTING

### Service Won't Start

**Check logs:**
```bash
railway logs --tail 100
```

**Common issues:**
- Missing environment variables → Set all required vars
- Invalid Supabase URL → Check SUPABASE_URL format
- Port conflict → Should use PORT from env (defaults to 3000)

### Database Connection Failed

**Verify credentials:**
1. Supabase dashboard → Settings → API
2. Confirm Project URL matches SUPABASE_URL
3. Confirm anon key matches SUPABASE_ANON_KEY

**Test connection:**
```bash
# In Railway logs, should see:
✅ Database connection successful
```

### Playwright Errors

**If Playwright fails:**
- Railway may need additional dependencies
- Add to package.json if needed
- Check Railway build logs for missing libraries

**Fix:** Railway typically has Playwright support, but may need:
```json
{
  "scripts": {
    "postinstall": "npx playwright install-deps"
  }
}
```

### Authentication Not Working

**Verify API key:**
- Check Railway env var API_KEY matches what you're using
- No extra spaces
- Lowercase header: `x-api-key`

**Test:**
```bash
# Check Railway env vars
railway variables
```

---

## MONITORING AFTER DEPLOYMENT

### First Hour

1. **Check logs every 10 minutes**
   ```bash
   railway logs --tail 50
   ```

2. **Verify cron jobs running**
   - Health checks every 60 seconds
   - Browser monitoring every 5 minutes
   - Security scanning every 10 minutes

3. **Check database for activity**
   ```sql
   SELECT COUNT(*), MAX(checked_at)
   FROM monitoring_checks;
   ```

### First 24 Hours

1. **Check for incidents**
   ```sql
   SELECT * FROM incidents
   ORDER BY detected_at DESC
   LIMIT 10;
   ```

2. **Review security events**
   ```sql
   SELECT * FROM security_events
   ORDER BY event_timestamp DESC
   LIMIT 10;
   ```

3. **Monitor costs**
   - Railway dashboard → Usage
   - Supabase dashboard → Database usage

### Ongoing

- **Daily:** Review Railway logs for errors
- **Weekly:** Check incident trends
- **Monthly:** Review security events, optimize thresholds

---

## CREDENTIALS REFERENCE

**Supabase:**
- Project URL: https://zstqmlhhpxatbhvsfrvd.supabase.co
- Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
- Dashboard: https://supabase.com/dashboard/project/zstqmlhhpxatbhvsfrvd

**Production API Key:**
- `74eaceebf3698d602f007123e8960c927fc00c3dce67a9c212170f020d72769b`

**Allowed Origins:**
- https://admin.ib365.ai
- https://demo.ib365.ai

---

## QUICK START (5 Minutes)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Navigate to project
cd /Users/riscentrdb/Desktop/autonomous-agent

# 4. Initialize
railway init

# 5. Set variables (copy/paste all at once)
railway variables set SUPABASE_URL="https://zstqmlhhpxatbhvsfrvd.supabase.co"
railway variables set SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzdHFtbGhocHhhdGJodnNmcnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc1NjU4NzgsImV4cCI6MjA0MzE0MTg3OH0.4e5Jv4-_G8sTmWIb-rSBn5BcUqj6wU7VqTi4N5eHhBs"
railway variables set API_KEY="74eaceebf3698d602f007123e8960c927fc00c3dce67a9c212170f020d72769b"
railway variables set ALLOWED_ORIGINS="https://admin.ib365.ai,https://demo.ib365.ai"
railway variables set ADMIN_CONSOLE_URL="https://admin.ib365.ai"
railway variables set NODE_ENV="production"

# 6. Deploy
railway up

# 7. Get URL
railway status

# 8. Test
curl https://YOUR-URL.railway.app/health
```

---

## SUPPORT

**If stuck:**
1. Check Railway logs: `railway logs`
2. Check Supabase status
3. Review DEPLOYMENT_COMPLETE_CHECKLIST.md
4. Check Week 1 Final Report for details

**Documentation:**
- `/Users/riscentrdb/Desktop/autonomous-agent/README.md`
- `/Users/riscentrdb/Desktop/liaison/WEEK_1_FINAL_REPORT.md`
- `/Users/riscentrdb/Desktop/autonomous-agent/DEPLOYMENT_INSTRUCTIONS.md`

---

**READY TO DEPLOY** ✅

Follow Option 1 (Railway CLI) for fastest deployment.
