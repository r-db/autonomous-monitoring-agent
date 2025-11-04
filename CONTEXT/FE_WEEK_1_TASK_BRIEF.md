# FRONTEND WEEK 1 TASKS - Autonomous Monitoring Agent

**Agent:** Frontend (FE)
**Week:** Week 1 - Foundation
**Duration:** 12-17 hours
**Priority:** HIGH - Week 1 Foundation
**Status:** READY TO START (Wait for BE Task 2 completion)

---

## MISSION

Build Playwright browser monitoring, basic security scanner, and manual trigger endpoint for the Autonomous Monitoring & Security Agent. Your work will detect frontend errors in real-time by monitoring browser console logs and capturing screenshots.

---

## CONTEXT

You are building the frontend monitoring capabilities that will:
1. Monitor admin console pages for console.error and console.warn
2. Capture screenshots when errors occur
3. Detect security anomalies
4. Provide manual testing endpoints

**This week (Week 1):** Focus on detection and logging. No auto-fixes yet.

---

## DEPENDENCIES

**MUST WAIT FOR:**
- BE agent to complete Task 2 (Database tables created)
- Database tables: `incidents`, `monitoring_checks`, `security_events` must exist

**Before starting, verify:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('incidents', 'monitoring_checks', 'security_events');
```

---

## REFERENCE DOCUMENTS

**MUST READ:**
- `/Users/riscentrdb/Desktop/liaison/AUTONOMOUS_AGENT_ARCHITECTURE.md`
  - Focus on: Section 2.2 (Error Detection - Playwright Monitoring)
- `/Users/riscentrdb/Desktop/liaison/AUTONOMOUS_AGENT_BUILD_PLAN.md`
  - Focus on: Week 1, FE Tasks (lines 292-378)

**Project Location:** `/Users/riscentrdb/Desktop/autonomous-agent`

---

## TASKS (3 Major Tasks)

### Task 1: Implement Playwright Browser Monitoring (6-8 hours)

**Objective:** Monitor admin console pages for JavaScript errors using Playwright

**Steps:**

1. Install Playwright:
```bash
cd /Users/riscentrdb/Desktop/autonomous-agent
npm install playwright
npx playwright install chromium
```

2. Create `src/monitors/browser-monitor.js`:
```javascript
const { chromium } = require('playwright');
const { supabase } = require('../config/database');
const { logAgentAction } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const PAGES_TO_MONITOR = [
  { url: `${process.env.ADMIN_CONSOLE_URL}/`, name: 'Dashboard', critical: true },
  { url: `${process.env.ADMIN_CONSOLE_URL}/agents`, name: 'Agents', critical: true },
  { url: `${process.env.ADMIN_CONSOLE_URL}/token-budget`, name: 'Token Budget', critical: false },
  { url: `${process.env.ADMIN_CONSOLE_URL}/tenants`, name: 'Tenants', critical: true },
  { url: `${process.env.ADMIN_CONSOLE_URL}/settings`, name: 'Settings', critical: false }
];

async function monitorBrowserErrors() {
  console.log('[BROWSER MONITOR] Starting browser checks...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const page of PAGES_TO_MONITOR) {
    await checkPage(browser, page);
  }

  await browser.close();
  console.log('[BROWSER MONITOR] Completed');
}

async function checkPage(browser, pageConfig) {
  const startTime = Date.now();
  const checkId = `CHK-BROWSER-${Date.now()}-${pageConfig.name}`;

  console.log(`[BROWSER CHECK] ${pageConfig.name} - ${pageConfig.url}`);

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Autonomous Monitor) Playwright'
    });

    const page = await context.newPage();

    // Collect errors
    const errors = [];
    const warnings = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      errors.push(`Unhandled error: ${error.message}`);
    });

    // Navigate to page
    try {
      await page.goto(pageConfig.url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait a bit for any async errors
      await page.waitForTimeout(5000);

    } catch (navError) {
      errors.push(`Navigation failed: ${navError.message}`);
    }

    const responseTime = Date.now() - startTime;

    // Log check
    await supabase.from('monitoring_checks').insert({
      check_id: checkId,
      check_type: 'browser',
      target: pageConfig.url,
      application: 'admin-console-frontend',
      status: errors.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'healthy'),
      response_time_ms: responseTime,
      errors_detected: errors.length,
      error_details: {
        page_name: pageConfig.name,
        errors: errors,
        warnings: warnings
      }
    });

    // Create incident if errors found
    if (errors.length > 0) {
      const screenshot = await page.screenshot({ fullPage: true });
      const screenshotPath = `/tmp/screenshot-${checkId}.png`;
      await fs.writeFile(screenshotPath, screenshot);

      const severity = pageConfig.critical ? 'HIGH' : 'MEDIUM';

      const { data: incident } = await supabase
        .from('incidents')
        .insert({
          incident_id: `INC-BROWSER-${Date.now()}`,
          title: `Browser error on ${pageConfig.name}`,
          error_message: errors[0],
          error_type: 'browser_console_error',
          severity: severity,
          category: 'frontend',
          application: 'admin-console-frontend',
          status: 'detected',
          context: {
            page_name: pageConfig.name,
            page_url: pageConfig.url,
            errors: errors,
            warnings: warnings,
            screenshot_path: screenshotPath
          }
        })
        .select()
        .single();

      console.error(`[BROWSER ERROR] ${pageConfig.name} - ${errors.length} errors detected`);
      console.error(`  First error: ${errors[0]}`);

      await logAgentAction({
        agent_id: 'browser-monitor',
        agent_type: 'monitoring',
        action_type: 'browser_error_detected',
        action_description: `Browser error detected on ${pageConfig.name}`,
        action_success: false,
        incident_id: incident?.id,
        action_details: {
          errors_count: errors.length,
          page: pageConfig.name
        }
      });
    } else {
      console.log(`[BROWSER OK] ${pageConfig.name} - No errors detected`);
    }

    await context.close();

  } catch (error) {
    console.error(`[BROWSER MONITOR ERROR] ${pageConfig.name}:`, error);

    await supabase.from('monitoring_checks').insert({
      check_id: checkId,
      check_type: 'browser',
      target: pageConfig.url,
      application: 'admin-console-frontend',
      status: 'error',
      errors_detected: 1,
      error_details: {
        page_name: pageConfig.name,
        error: error.message
      }
    });

    // Create incident for monitoring failure
    await supabase.from('incidents').insert({
      incident_id: `INC-BROWSER-${Date.now()}`,
      title: `Browser monitoring failed: ${pageConfig.name}`,
      error_message: `Failed to monitor ${pageConfig.name}: ${error.message}`,
      error_type: 'monitoring_failure',
      severity: 'HIGH',
      category: 'infrastructure',
      application: 'autonomous-monitoring-agent',
      status: 'detected',
      context: {
        page_name: pageConfig.name,
        error: error.message
      }
    });
  }
}

module.exports = { monitorBrowserErrors };
```

3. Update `src/cron/monitoring-cron.js` to include browser checks:
```javascript
const { monitorBrowserErrors } = require('../monitors/browser-monitor');

// Run browser checks every 5 minutes (stagger from health checks)
cron.schedule('*/5 * * * *', async () => {
  try {
    await monitorBrowserErrors();
  } catch (error) {
    console.error('[CRON ERROR] Browser monitoring failed:', error);
  }
});
```

4. Test locally:
```bash
node -e "require('./src/monitors/browser-monitor').monitorBrowserErrors()"
```

5. Verify in database:
```sql
SELECT * FROM monitoring_checks WHERE check_type = 'browser' ORDER BY timestamp DESC LIMIT 5;
SELECT * FROM incidents WHERE error_type = 'browser_console_error' ORDER BY detected_at DESC LIMIT 5;
```

**Acceptance Criteria:**
- ✅ Playwright installed and browsers cached
- ✅ Browser checks run every 5 minutes
- ✅ Console errors captured and stored
- ✅ Screenshots taken on error
- ✅ No memory leaks from repeated checks
- ✅ Browser closes properly after each check
- ✅ Incidents created for errors
- ✅ All checks logged to database

**Evidence Required:**
- Screenshot showing Playwright successfully opening a page
- Database query showing browser checks: `SELECT COUNT(*) FROM monitoring_checks WHERE check_type='browser' AND timestamp > NOW() - INTERVAL '1 hour';`
- Sample screenshot file from `/tmp/`
- Logs showing browser checks running

---

### Task 2: Create Basic Security Scanner (4-6 hours)

**Objective:** Monitor for security anomalies and suspicious patterns

**Steps:**

1. Create `src/monitors/security-monitor.js`:
```javascript
const { supabase } = require('../config/database');
const { logAgentAction } = require('../utils/logger');

// Security monitoring rules
const SECURITY_RULES = {
  rate_limit_threshold: 100, // requests per minute
  failed_login_threshold: 5,  // failed logins per hour
  unusual_access_window: { start: 0, end: 6 } // 12am-6am
};

async function runSecurityChecks() {
  console.log('[SECURITY MONITOR] Running security checks...');

  await checkRateLimitAnomalies();
  await checkUnusualAccessPatterns();
  await checkFailedLoginAttempts();

  console.log('[SECURITY MONITOR] Completed');
}

async function checkRateLimitAnomalies() {
  try {
    // This would integrate with your actual access logs
    // For now, we'll check monitoring_checks frequency as a proxy

    const { data: checks } = await supabase
      .from('monitoring_checks')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 60000).toISOString())
      .order('timestamp', { ascending: false });

    if (checks && checks.length > SECURITY_RULES.rate_limit_threshold) {
      const eventId = `SEC-RATE-${Date.now()}`;

      await supabase.from('security_events').insert({
        event_id: eventId,
        event_type: 'rate_limit_anomaly',
        severity: 'MEDIUM',
        status: 'detected',
        description: `Unusually high request rate detected: ${checks.length} requests in 1 minute`,
        confidence_score: 0.8,
        metadata: {
          requests_per_minute: checks.length,
          threshold: SECURITY_RULES.rate_limit_threshold
        }
      });

      console.warn(`[SECURITY] Rate limit anomaly: ${checks.length} req/min`);
    }

  } catch (error) {
    console.error('[SECURITY] Rate limit check error:', error);
  }
}

async function checkUnusualAccessPatterns() {
  try {
    const currentHour = new Date().getHours();

    // Check if we're in unusual access window
    if (currentHour >= SECURITY_RULES.unusual_access_window.start &&
        currentHour <= SECURITY_RULES.unusual_access_window.end) {

      const { data: recentChecks } = await supabase
        .from('monitoring_checks')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 300000).toISOString()) // last 5 min
        .order('timestamp', { ascending: false });

      if (recentChecks && recentChecks.length > 10) {
        const eventId = `SEC-ACCESS-${Date.now()}`;

        await supabase.from('security_events').insert({
          event_id: eventId,
          event_type: 'unusual_access_pattern',
          severity: 'MEDIUM',
          status: 'detected',
          description: `Unusual access detected at ${currentHour}:00 (outside normal hours)`,
          confidence_score: 0.7,
          metadata: {
            hour: currentHour,
            requests: recentChecks.length
          }
        });

        console.warn(`[SECURITY] Unusual access at ${currentHour}:00`);
      }
    }

  } catch (error) {
    console.error('[SECURITY] Access pattern check error:', error);
  }
}

async function checkFailedLoginAttempts() {
  try {
    // This would integrate with Clerk or your auth system
    // For now, we'll check for auth-related errors in incidents

    const { data: authErrors } = await supabase
      .from('incidents')
      .select('*')
      .eq('category', 'security')
      .gte('detected_at', new Date(Date.now() - 3600000).toISOString()) // last hour
      .order('detected_at', { ascending: false });

    if (authErrors && authErrors.length >= SECURITY_RULES.failed_login_threshold) {
      const eventId = `SEC-AUTH-${Date.now()}`;

      const { data: incident } = await supabase
        .from('incidents')
        .insert({
          incident_id: `INC-SEC-${Date.now()}`,
          title: 'Multiple authentication failures detected',
          error_message: `${authErrors.length} authentication errors in the last hour`,
          error_type: 'security_alert',
          severity: 'HIGH',
          category: 'security',
          application: 'admin-console-backend',
          status: 'detected',
          context: {
            failed_attempts: authErrors.length,
            threshold: SECURITY_RULES.failed_login_threshold,
            timeframe: '1 hour'
          }
        })
        .select()
        .single();

      await supabase.from('security_events').insert({
        event_id: eventId,
        event_type: 'failed_login_attempts',
        severity: 'HIGH',
        status: 'detected',
        description: `${authErrors.length} failed authentication attempts in 1 hour`,
        confidence_score: 0.9,
        incident_created: incident?.id,
        metadata: {
          attempts: authErrors.length,
          threshold: SECURITY_RULES.failed_login_threshold
          }
      });

      await logAgentAction({
        agent_id: 'security-monitor',
        agent_type: 'monitoring',
        action_type: 'security_alert',
        action_description: `Multiple authentication failures detected`,
        action_success: true,
        incident_id: incident?.id
      });

      console.warn(`[SECURITY] ${authErrors.length} auth failures detected`);
    }

  } catch (error) {
    console.error('[SECURITY] Failed login check error:', error);
  }
}

module.exports = { runSecurityChecks };
```

2. Update `src/cron/monitoring-cron.js`:
```javascript
const { runSecurityChecks } = require('../monitors/security-monitor');

// Run security checks every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  try {
    await runSecurityChecks();
  } catch (error) {
    console.error('[CRON ERROR] Security monitoring failed:', error);
  }
});
```

3. Test:
```bash
node -e "require('./src/monitors/security-monitor').runSecurityChecks()"
```

**Acceptance Criteria:**
- ✅ Security checks run every 10 minutes
- ✅ Rate limit anomalies detected
- ✅ Unusual access patterns detected
- ✅ Security events logged to database
- ✅ High-severity events create incidents
- ✅ False positive rate < 10%

**Evidence Required:**
- Database query: `SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 10;`
- Logs showing security checks running
- Sample security event detection

---

### Task 3: Create Manual Trigger Endpoint (2-3 hours)

**Objective:** Allow manual testing of the monitoring system

**Steps:**

1. Create `src/routes/manual-trigger.js`:
```javascript
const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');
const { monitorBrowserErrors } = require('../monitors/browser-monitor');
const { runHealthChecks } = require('../monitors/health-check');
const { runSecurityChecks } = require('../monitors/security-monitor');
const { logAgentAction } = require('../utils/logger');

// POST /api/autonomous/trigger-test-error
router.post('/api/autonomous/trigger-test-error', async (req, res) => {
  try {
    const { error_type, severity, message } = req.body;

    const incidentId = `INC-TEST-${Date.now()}`;

    const { data: incident } = await supabase
      .from('incidents')
      .insert({
        incident_id: incidentId,
        title: `Test error: ${error_type || 'manual'}`,
        error_message: message || 'Manual test error for monitoring system',
        error_type: error_type || 'test_error',
        severity: severity || 'MEDIUM',
        category: 'test',
        application: 'autonomous-monitoring-agent',
        status: 'detected',
        context: {
          test: true,
          triggered_manually: true,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    await logAgentAction({
      agent_id: 'manual-trigger',
      agent_type: 'monitoring',
      action_type: 'test_error_created',
      action_description: 'Manual test error created',
      action_success: true,
      incident_id: incident.id
    });

    console.log(`[MANUAL TRIGGER] Test error created: ${incidentId}`);

    res.json({
      success: true,
      incident_id: incidentId,
      incident: incident
    });

  } catch (error) {
    console.error('[MANUAL TRIGGER] Error:', error);
    res.status(500).json({ error: 'Failed to create test error' });
  }
});

// POST /api/autonomous/trigger-monitoring
router.post('/api/autonomous/trigger-monitoring', async (req, res) => {
  try {
    const { type } = req.body; // 'browser' | 'health' | 'security' | 'all'

    res.json({ success: true, message: 'Monitoring triggered', type });

    // Run checks asynchronously
    if (type === 'browser' || type === 'all') {
      monitorBrowserErrors().catch(err => {
        console.error('[TRIGGER] Browser monitoring error:', err);
      });
    }

    if (type === 'health' || type === 'all') {
      runHealthChecks().catch(err => {
        console.error('[TRIGGER] Health check error:', err);
      });
    }

    if (type === 'security' || type === 'all') {
      runSecurityChecks().catch(err => {
        console.error('[TRIGGER] Security check error:', err);
      });
    }

  } catch (error) {
    console.error('[MANUAL TRIGGER] Error:', error);
    res.status(500).json({ error: 'Failed to trigger monitoring' });
  }
});

// GET /api/autonomous/status
router.get('/api/autonomous/status', async (req, res) => {
  try {
    // Get recent monitoring activity
    const { data: recentChecks } = await supabase
      .from('monitoring_checks')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 3600000).toISOString())
      .order('timestamp', { ascending: false })
      .limit(100);

    const { data: recentIncidents } = await supabase
      .from('incidents')
      .select('*')
      .gte('detected_at', new Date(Date.now() - 3600000).toISOString())
      .order('detected_at', { ascending: false })
      .limit(20);

    const { data: config } = await supabase
      .from('system_config')
      .select('*');

    const configMap = {};
    config?.forEach(item => {
      configMap[item.key] = item.value;
    });

    res.json({
      status: 'operational',
      monitoring_enabled: configMap.agent_monitoring_enabled?.enabled || false,
      auto_fix_enabled: configMap.agent_auto_fix_enabled?.enabled || false,
      kill_switch: configMap.agent_kill_switch?.enabled || false,
      last_hour_stats: {
        total_checks: recentChecks?.length || 0,
        total_incidents: recentIncidents?.length || 0,
        errors: recentChecks?.filter(c => c.status === 'error').length || 0,
        warnings: recentChecks?.filter(c => c.status === 'warning').length || 0
      },
      recent_incidents: recentIncidents?.slice(0, 5).map(i => ({
        incident_id: i.incident_id,
        severity: i.severity,
        category: i.category,
        error_message: i.error_message.substring(0, 100)
      }))
    });

  } catch (error) {
    console.error('[STATUS] Error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

module.exports = router;
```

2. Update `src/index.js`:
```javascript
const manualTriggerRoutes = require('./routes/manual-trigger');
app.use(manualTriggerRoutes);
```

3. Test endpoints:
```bash
# Test error creation
curl -X POST http://localhost:3000/api/autonomous/trigger-test-error \
  -H "Content-Type: application/json" \
  -d '{"error_type": "test", "severity": "HIGH", "message": "Test error from curl"}'

# Trigger browser monitoring
curl -X POST http://localhost:3000/api/autonomous/trigger-monitoring \
  -H "Content-Type: application/json" \
  -d '{"type": "browser"}'

# Get status
curl http://localhost:3000/api/autonomous/status
```

**Acceptance Criteria:**
- ✅ Manual trigger endpoints working
- ✅ Can create test errors
- ✅ Can trigger monitoring on-demand
- ✅ Status endpoint returns current state
- ✅ All actions logged
- ✅ Responds within 1 second

**Evidence Required:**
- Curl outputs showing successful responses
- Database entries for test incidents
- Status endpoint showing correct data

---

## ACCEPTANCE CRITERIA (Week 1 Frontend Complete)

### Deployed & Working:
- ✅ Playwright monitoring running every 5 minutes
- ✅ Browser errors detected and logged
- ✅ Screenshots captured on errors
- ✅ Security scanner running every 10 minutes
- ✅ Manual trigger endpoints operational

### Performance:
- ✅ Browser checks complete within 2 minutes
- ✅ No memory leaks from Playwright
- ✅ Screenshots stored and accessible
- ✅ Security checks complete within 30 seconds

### Testing:
- ✅ Can manually trigger monitoring
- ✅ Browser errors creating incidents
- ✅ Security events logged
- ✅ Status endpoint working

---

## DELIVERABLES

### Code Files:
1. `/autonomous-agent/src/monitors/browser-monitor.js`
2. `/autonomous-agent/src/monitors/security-monitor.js`
3. `/autonomous-agent/src/routes/manual-trigger.js`
4. Updated: `/autonomous-agent/src/cron/monitoring-cron.js`
5. Updated: `/autonomous-agent/src/index.js`

### Documentation:
1. Browser monitoring test results
2. Security scanner test results
3. Manual trigger curl commands
4. Screenshots from browser monitoring

### Database Evidence:
1. Browser checks: `SELECT COUNT(*) FROM monitoring_checks WHERE check_type='browser';`
2. Security events: `SELECT COUNT(*) FROM security_events;`
3. Test incidents: `SELECT * FROM incidents WHERE category='test';`

---

## TIMELINE

**Day 3:**
- Task 1: Playwright monitoring (6-8 hours)

**Day 4:**
- Task 2: Security scanner (4-6 hours)
- Task 3: Manual triggers (2-3 hours)

**Total:** 12-17 hours over 2 days

---

## NOTES

- Wait for BE to complete database setup before starting
- Test Playwright locally before deploying to Railway
- Ensure browser closes properly to avoid memory leaks
- Coordinate with QA for integration testing

---

## CONTACT

**PM Coordinator:** Reports to Liaison
**Dependencies:** BE agent (database tables)
**Next Agent:** QA agent (starts after FE tasks complete)

**Questions?** Update `/Users/riscentrdb/Desktop/autonomous-agent/CONTEXT/FE_PROGRESS.md` with blockers

---

## START

**Wait for:** BE Task 2 completion (database tables)
**First task:** Task 1 - Implement Playwright monitoring
**First milestone:** Browser monitoring working locally

**READY! ⚡**
