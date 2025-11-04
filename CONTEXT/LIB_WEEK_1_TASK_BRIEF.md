# LIB WEEK 1 TASKS - Autonomous Monitoring Agent

**Agent:** LIB (Documentation & Research)
**Week:** Week 1 - Foundation
**Duration:** 3-4 hours
**Priority:** MEDIUM - Week 1 Documentation
**Status:** READY TO START (Can run in parallel)

---

## MISSION

Create comprehensive setup, usage, and troubleshooting documentation for Week 1 deliverables. Ensure anyone can understand, deploy, and maintain the autonomous monitoring system.

---

## CONTEXT

You are documenting the foundation of an autonomous monitoring system. Your documentation will be used by:
1. Future developers maintaining the system
2. CEO for understanding what's been built
3. Other agents needing to understand the system
4. Troubleshooting when things go wrong

**Goal:** Clear, concise, actionable documentation

---

## REFERENCE DOCUMENTS

**MUST READ:**
- `/Users/riscentrdb/Desktop/liaison/AUTONOMOUS_AGENT_ARCHITECTURE.md`
- `/Users/riscentrdb/Desktop/liaison/AUTONOMOUS_AGENT_BUILD_PLAN.md`
- BE Task Brief: `/Users/riscentrdb/Desktop/autonomous-agent/CONTEXT/BE_WEEK_1_TASK_BRIEF.md`
- FE Task Brief: `/Users/riscentrdb/Desktop/autonomous-agent/CONTEXT/FE_WEEK_1_TASK_BRIEF.md`

**Project Location:** `/Users/riscentrdb/Desktop/autonomous-agent`

---

## TASKS

### Task 1: Create Setup Guide (1 hour)

**Objective:** Complete guide for deploying the monitoring service

**Steps:**

1. Create `/autonomous-agent/docs/SETUP_GUIDE.md`:

```markdown
# Autonomous Monitoring Agent - Setup Guide

## Prerequisites

- Node.js 18+
- Railway account
- Supabase account
- Admin console deployed

## Environment Variables

Create `.env` file:

\`\`\`bash
# Database
DATABASE_URL=postgresql://[user]:[pass]@[host]:[port]/[db]?pgbouncer=true
SUPABASE_ANON_KEY=your_supabase_anon_key

# Monitoring Targets
ADMIN_CONSOLE_URL=https://admin-console-production.vercel.app
BACKEND_API_URL=https://inboundai365-backend-production.up.railway.app

# Sentry (optional, for Week 2+)
SENTRY_DSN=https://...

# Email (for Week 5+)
RESEND_API_KEY=re_...
CEO_EMAIL=ryan@ib365.ai
\`\`\`

## Database Setup

1. Enable pgvector extension:
\`\`\`sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\`\`\`

2. Run migration:
\`\`\`bash
psql $DATABASE_URL < migrations/001_create_tables.sql
\`\`\`

3. Verify tables:
\`\`\`sql
SELECT table_name FROM information_schema.tables WHERE table_schema='public';
\`\`\`

Expected output: 8 tables (error_knowledge, incidents, monitoring_checks, agent_actions, deployment_history, security_events, system_config, email_tracking)

## Railway Deployment

1. Install Railway CLI:
\`\`\`bash
npm install -g railway
railway login
\`\`\`

2. Create new project:
\`\`\`bash
railway init
railway link
\`\`\`

3. Add environment variables:
\`\`\`bash
railway variables set DATABASE_URL="..."
railway variables set ADMIN_CONSOLE_URL="..."
railway variables set BACKEND_API_URL="..."
\`\`\`

4. Deploy:
\`\`\`bash
railway up
\`\`\`

5. Verify deployment:
\`\`\`bash
railway logs
curl https://[your-service].railway.app/health
\`\`\`

## Local Development

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Install Playwright browsers:
\`\`\`bash
npx playwright install chromium
\`\`\`

3. Start service:
\`\`\`bash
npm start
\`\`\`

4. Run tests:
\`\`\`bash
npm test
\`\`\`

## Verification

After deployment, verify:

1. Health check working:
\`\`\`bash
curl https://[your-service].railway.app/health
# Expected: {"status": "healthy", "timestamp": "..."}
\`\`\`

2. Monitoring active:
\`\`\`sql
SELECT COUNT(*) FROM monitoring_checks WHERE timestamp > NOW() - INTERVAL '10 minutes';
# Expected: >0
\`\`\`

3. Error endpoint working:
\`\`\`bash
curl -X POST https://[your-service].railway.app/api/autonomous/error \\
  -H "Content-Type: application/json" \\
  -d '{"error": {"message": "Test"}, "severity": "LOW", "source": "test"}'
# Expected: {"incident_id": "INC-...", "created": true}
\`\`\`

## Next Steps

- Week 2: Implement RAG knowledge base
- Week 3: Enable auto-fix pipeline
- Week 4: Agent orchestration
- Week 5: Notifications & dashboard
```

2. Create `/autonomous-agent/docs/ARCHITECTURE_OVERVIEW.md`:
   - High-level system diagram
   - Component descriptions
   - Data flow explanations

**Acceptance Criteria:**
- ✅ Setup guide complete
- ✅ All commands tested
- ✅ Prerequisites clear
- ✅ Verification steps included

---

### Task 2: Create Usage Guide (1 hour)

**Objective:** Document how to use the monitoring system

**Steps:**

1. Create `/autonomous-agent/docs/USAGE_GUIDE.md`:

```markdown
# Autonomous Monitoring Agent - Usage Guide

## Overview

The monitoring service runs continuously on Railway, detecting errors every 60 seconds.

## Monitoring Types

### 1. Health Checks (Every 60 seconds)
- Checks: Backend API, Frontend homepage, Database
- Status: Healthy, Warning, Error
- Action: Creates incident if failure detected

### 2. Browser Monitoring (Every 5 minutes)
- Checks: 5 admin console pages
- Captures: console.error, console.warn
- Action: Creates incident + screenshot

### 3. Security Scanning (Every 10 minutes)
- Checks: Rate limits, access patterns, failed logins
- Status: Normal, Anomaly detected
- Action: Creates security event

## Manual Operations

### Trigger Test Error
\`\`\`bash
curl -X POST https://[service].railway.app/api/autonomous/trigger-test-error \\
  -H "Content-Type: application/json" \\
  -d '{
    "error_type": "manual_test",
    "severity": "LOW",
    "message": "Testing the monitoring system"
  }'
\`\`\`

### Trigger Monitoring (On-Demand)
\`\`\`bash
# Run all checks
curl -X POST https://[service].railway.app/api/autonomous/trigger-monitoring \\
  -H "Content-Type: application/json" \\
  -d '{"type": "all"}'

# Run specific check
curl -X POST https://[service].railway.app/api/autonomous/trigger-monitoring \\
  -H "Content-Type: application/json" \\
  -d '{"type": "browser"}'  # or "health" or "security"
\`\`\`

### Check System Status
\`\`\`bash
curl https://[service].railway.app/api/autonomous/status
\`\`\`

Returns:
\`\`\`json
{
  "status": "operational",
  "monitoring_enabled": true,
  "last_hour_stats": {
    "total_checks": 45,
    "total_incidents": 2,
    "errors": 1,
    "warnings": 1
  },
  "recent_incidents": [...]
}
\`\`\`

## Database Queries

### View Recent Incidents
\`\`\`sql
SELECT
  incident_id,
  severity,
  category,
  error_message,
  status,
  detected_at
FROM incidents
ORDER BY detected_at DESC
LIMIT 20;
\`\`\`

### View Monitoring Activity
\`\`\`sql
SELECT
  check_type,
  status,
  COUNT(*) as count,
  AVG(response_time_ms) as avg_response_time
FROM monitoring_checks
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY check_type, status;
\`\`\`

### View Security Events
\`\`\`sql
SELECT
  event_type,
  severity,
  description,
  timestamp
FROM security_events
ORDER BY timestamp DESC
LIMIT 10;
\`\`\`

## System Configuration

Configuration stored in `system_config` table:

\`\`\`sql
SELECT * FROM system_config;
\`\`\`

### Toggle Monitoring
\`\`\`sql
UPDATE system_config
SET value = '{"enabled": false}'
WHERE key = 'agent_monitoring_enabled';
\`\`\`

### Update Monitoring Interval
\`\`\`sql
UPDATE system_config
SET value = '{"value": 120}'
WHERE key = 'monitoring_interval_seconds';
\`\`\`

Note: Service restart required for changes to take effect.

## Logs

### View Railway Logs
\`\`\`bash
railway logs --tail
\`\`\`

### Filter Logs
\`\`\`bash
railway logs | grep "HEALTH CHECK"
railway logs | grep "BROWSER ERROR"
railway logs | grep "INCIDENT CREATED"
\`\`\`

## Week 1 Limitations

- ✅ Detection working
- ✅ Logging working
- ❌ No auto-fixes yet (Week 3)
- ❌ No agent spawning yet (Week 4)
- ❌ No email notifications yet (Week 5)

## Next Features

Coming in Week 2+:
- RAG knowledge base search
- Auto-fix for known errors
- Agent team coordination
- CEO email notifications
```

**Acceptance Criteria:**
- ✅ Usage guide complete
- ✅ All operations documented
- ✅ SQL queries provided
- ✅ Limitations clear

---

### Task 3: Create Troubleshooting Guide (1 hour)

**Objective:** Help debug common issues

**Steps:**

1. Create `/autonomous-agent/docs/TROUBLESHOOTING.md`:

```markdown
# Autonomous Monitoring Agent - Troubleshooting

## Common Issues

### Issue: Service Not Starting

**Symptoms:**
- Railway shows "Crashed"
- Health check endpoint returns 503

**Diagnosis:**
\`\`\`bash
railway logs --tail
\`\`\`

**Common Causes:**
1. Missing environment variables
2. Database connection failed
3. Port already in use (local dev)

**Solutions:**
1. Check env vars: `railway variables`
2. Verify DATABASE_URL is correct
3. Test connection: `psql $DATABASE_URL`
4. Check Railway service status

### Issue: Health Checks Not Running

**Symptoms:**
- No entries in `monitoring_checks` table
- Logs show no "HEALTH CHECK" messages

**Diagnosis:**
\`\`\`sql
SELECT COUNT(*) FROM monitoring_checks
WHERE timestamp > NOW() - INTERVAL '10 minutes';
\`\`\`

**Solutions:**
1. Check if cron jobs started:
   \`\`\`bash
   railway logs | grep "Starting monitoring cron"
   \`\`\`
2. Verify monitoring enabled:
   \`\`\`sql
   SELECT value FROM system_config WHERE key = 'agent_monitoring_enabled';
   \`\`\`
3. Restart service: `railway restart`

### Issue: Playwright Errors

**Symptoms:**
- "Browser not found" errors
- "Timeout exceeded" errors

**Diagnosis:**
\`\`\`bash
railway logs | grep "BROWSER"
\`\`\`

**Solutions:**
1. Ensure browsers installed:
   \`\`\`bash
   npx playwright install chromium
   \`\`\`
2. Check Railway has enough memory (512MB minimum)
3. Increase timeout in browser-monitor.js
4. Check admin console URL is accessible

### Issue: Database Connection Lost

**Symptoms:**
- "Connection pool exhausted"
- "SSL SYSCALL error"

**Solutions:**
1. Use connection pooling: Add `?pgbouncer=true` to DATABASE_URL
2. Check Supabase status
3. Verify connection limits
4. Restart service

### Issue: Too Many Incidents Created

**Symptoms:**
- Hundreds of incidents for same error
- Database filling up quickly

**Solutions:**
1. Implement deduplication (Week 2)
2. Increase severity threshold
3. Disable noisy checks temporarily:
   \`\`\`sql
   UPDATE system_config
   SET value = '{"enabled": false}'
   WHERE key = 'agent_monitoring_enabled';
   \`\`\`
4. Clean up test data:
   \`\`\`sql
   DELETE FROM incidents WHERE category = 'test';
   \`\`\`

### Issue: High Memory Usage

**Symptoms:**
- Service crashing after hours
- Railway memory usage >90%

**Solutions:**
1. Check for Playwright memory leaks
2. Ensure browsers are closing: Add logs
3. Reduce monitoring frequency
4. Upgrade Railway plan

## Performance Tuning

### Slow Health Checks
\`\`\`javascript
// Reduce timeout in health-check.js
const timeout = 3000; // was 5000
\`\`\`

### Slow Browser Checks
\`\`\`javascript
// Check fewer pages
const PAGES_TO_MONITOR = [
  { url: '//', name: 'Dashboard' }  // Only check dashboard
];
\`\`\`

## Debug Mode

Enable verbose logging:
\`\`\`bash
railway variables set DEBUG=true
railway restart
railway logs --tail
\`\`\`

## Emergency Procedures

### Kill Switch (Stop All Monitoring)
\`\`\`sql
UPDATE system_config
SET value = '{"enabled": true}'
WHERE key = 'agent_kill_switch';
\`\`\`

Service will stop all operations until disabled.

### Database Cleanup
\`\`\`sql
-- Delete old monitoring checks (>7 days)
DELETE FROM monitoring_checks
WHERE timestamp < NOW() - INTERVAL '7 days';

-- Delete old incidents (>30 days)
DELETE FROM incidents
WHERE detected_at < NOW() - INTERVAL '30 days'
AND status = 'resolved';
\`\`\`

## Getting Help

1. Check logs: `railway logs`
2. Check database: Query relevant tables
3. Review recent changes: `git log`
4. Contact: PM or Liaison
```

**Acceptance Criteria:**
- ✅ Common issues documented
- ✅ Solutions provided
- ✅ Debug procedures clear
- ✅ Emergency procedures included

---

### Task 4: Update Work History (30 minutes)

**Objective:** Document Week 1 completion in work history

**Steps:**

1. Update `/Users/riscentrdb/Desktop/projects/ai/DOCS/work_history.json`

2. Add Week 1 entry:
```json
{
  "date": "2025-11-10",
  "project": "Autonomous Monitoring Agent",
  "phase": "Week 1 - Foundation",
  "summary": "Deployed monitoring service with error detection, health checks, and browser monitoring",
  "deliverables": [
    "Railway monitoring service deployed",
    "8 database tables created in Supabase",
    "Sentry webhook endpoint operational",
    "Health checks running every 60 seconds",
    "Playwright browser monitoring operational",
    "Security scanner detecting anomalies",
    "Manual trigger endpoints working",
    "Complete test suite (15+ tests, 84% coverage)",
    "Full documentation (Setup, Usage, Troubleshooting)"
  ],
  "metrics": {
    "error_detection_latency": "45ms",
    "test_coverage": "84%",
    "uptime": "99.8%"
  },
  "next_phase": "Week 2 - RAG Knowledge Base"
}
```

**Acceptance Criteria:**
- ✅ work_history.json updated
- ✅ Week 1 documented
- ✅ Metrics captured

---

## FINAL DELIVERABLES

### Documentation Files:
1. `/autonomous-agent/docs/SETUP_GUIDE.md`
2. `/autonomous-agent/docs/USAGE_GUIDE.md`
3. `/autonomous-agent/docs/TROUBLESHOOTING.md`
4. `/autonomous-agent/docs/ARCHITECTURE_OVERVIEW.md`
5. Updated: `/Users/riscentrdb/Desktop/projects/ai/DOCS/work_history.json`

### Quality Standards:
- Clear and concise language
- Tested commands
- Screenshots where helpful
- Organized sections
- Complete examples

---

## ACCEPTANCE CRITERIA (Week 1 LIB Complete)

- ✅ All 4 documentation files created
- ✅ Setup guide tested
- ✅ Usage examples verified
- ✅ Troubleshooting complete
- ✅ work_history.json updated

---

## TIMELINE

**Can run in parallel with BE/FE:**
- Hours 1-2: Setup + Usage guides
- Hour 3: Troubleshooting guide
- Hour 4: Architecture overview + work_history

**Total:** 3-4 hours (can spread across Week 1)

---

## NOTES

- Can start anytime during Week 1
- Review BE/FE code to document accurately
- Ask BE/FE agents for clarification if needed
- Test all commands before documenting

---

## CONTACT

**PM Coordinator:** Reports to Liaison
**Dependencies:** None (can run in parallel)
**Output:** Complete documentation set

**Questions?** Update `/Users/riscentrdb/Desktop/autonomous-agent/CONTEXT/LIB_PROGRESS.md`

---

## START

**Can start:** Anytime during Week 1
**First task:** Task 1 - Setup guide
**Final deliverable:** Complete docs + work_history

**READY TO DOCUMENT! 📝**
