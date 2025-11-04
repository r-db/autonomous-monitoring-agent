# Quick Start Guide - Autonomous Monitoring Agent

**5-Minute Deployment** | November 4, 2025

---

## Step 1: Install Dependencies (1 min)

```bash
cd /Users/riscentrdb/Desktop/autonomous-agent
npm install
```

---

## Step 2: Deploy Database (2 min)

1. Open: https://app.supabase.com/project/YOUR_PROJECT/sql
2. Copy entire contents of `migrations/001_create_tables.sql`
3. Paste and click "Run"
4. Verify: "✅ All 8 tables created successfully"

---

## Step 3: Deploy to Railway (2 min)

```bash
# Login
railway login

# Initialize
railway init
# Name: autonomous-monitoring-agent

# Set environment variables (replace with your values)
railway variables set SUPABASE_URL="https://xxx.supabase.co"
railway variables set SUPABASE_ANON_KEY="eyJ..."
railway variables set NODE_ENV="production"
railway variables set BACKEND_API_URL="https://inboundai365-backend-production.up.railway.app"
railway variables set ADMIN_CONSOLE_URL="https://admin-console-production.vercel.app"

# Deploy
railway up
```

---

## Step 4: Test (30 sec)

```bash
# Get your Railway URL from the dashboard
RAILWAY_URL="https://your-service.railway.app"

# Test health
curl $RAILWAY_URL/health

# Expected: {"status":"healthy",...}

# Create test incident
curl -X POST $RAILWAY_URL/api/autonomous/error \
  -H "Content-Type: application/json" \
  -d '{"error":{"message":"Test"},"severity":"LOW","source":"test"}'

# Expected: {"incident_id":"INC-...","created":true}
```

---

## Step 5: Verify (1 min)

### Check Railway Logs
```bash
railway logs
```

**Look for:**
- `[STARTUP] Testing database connection...`
- `[DATABASE] Connection successful`
- `[CRON] Starting monitoring cron jobs...`
- `✅ Service ready and operational`

### Check Database

In Supabase SQL Editor:
```sql
-- Should return 8 rows
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Wait 2 minutes, then check health checks
SELECT COUNT(*) FROM monitoring_checks;
-- Expected: 6-10 rows (3 checks/min × 2-3 min)
```

---

## ✅ Complete!

Your monitoring agent is now:
- 🔍 Detecting errors in real-time
- ❤️ Checking health every 60 seconds
- 💾 Storing all incidents in database
- 📝 Logging all actions

---

## Next Steps

1. **Monitor for 5 minutes** - Verify health checks running
2. **Check Railway dashboard** - Ensure service is stable
3. **Review incidents** - Check Supabase for monitoring data
4. **Read full docs** - See README.md and DEPLOYMENT_GUIDE.md

---

## Troubleshooting

**Database connection failed?**
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Check Supabase project is active (not paused)

**Health checks not running?**
- Wait 60-90 seconds after deployment
- Check Railway logs for errors
- Verify cron started: `railway logs | grep CRON`

**Can't create incidents?**
- Verify database migration ran successfully
- Check `incidents` table exists in Supabase

---

## Support

- **Full Docs:** README.md (416 lines)
- **Deployment Guide:** DEPLOYMENT_GUIDE.md (513 lines)
- **Completion Report:** CONTEXT/BE_WEEK_1_EXECUTION_REPORT.md

**Status:** ✅ Production Ready
