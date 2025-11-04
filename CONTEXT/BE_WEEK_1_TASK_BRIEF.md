# BACKEND WEEK 1 TASKS - Autonomous Monitoring Agent

**Agent:** Backend (BE)
**Week:** Week 1 - Foundation
**Duration:** 18-25 hours
**Priority:** CRITICAL - Week 1 Foundation
**Status:** READY TO START

---

## MISSION

Build the backend foundation for the Autonomous Monitoring & Security Agent. You will create the Railway monitoring service, set up 8 database tables in Supabase, implement the Sentry webhook endpoint, and create the health check service that runs every 60 seconds.

---

## CONTEXT

You are building the foundation of a system that will:
1. Monitor all applications for errors 24/7
2. Detect errors within 60 seconds
3. Store all incidents in a database
4. Eventually auto-fix known errors (Week 3+)
5. Spawn agent teams for unknown errors (Week 4+)

**This week (Week 1):** Focus ONLY on detection and logging. No auto-fixes yet.

---

## REFERENCE DOCUMENTS

**MUST READ BEFORE STARTING:**
- `/Users/riscentrdb/Desktop/liaison/AUTONOMOUS_AGENT_ARCHITECTURE.md`
  - Focus on: Sections 2-4 (Component Specifications, Database Schemas, API Endpoints)
- `/Users/riscentrdb/Desktop/liaison/AUTONOMOUS_AGENT_BUILD_PLAN.md`
  - Focus on: Week 1 section (lines 131-500)

**Project Location:** `/Users/riscentrdb/Desktop/autonomous-agent`

---

## TASKS (4 Major Tasks)

### Task 1: Create Railway Monitoring Service (4-6 hours)

**Objective:** Deploy a Node.js service on Railway that runs 24/7

**Steps:**
1. Set up Railway project
   - Service name: `autonomous-monitoring-agent`
   - Region: US West (or closest to existing services)
   - Resources: 512 MB RAM, 1 vCPU

2. Create project structure in `/Users/riscentrdb/Desktop/autonomous-agent`:
   ```
   autonomous-agent/
   ├── src/
   │   ├── index.js          # Main entry point
   │   ├── config/
   │   │   └── database.js   # Supabase connection
   │   ├── routes/
   │   │   └── health.js     # Health check endpoint
   │   ├── services/
   │   ├── monitors/
   │   └── utils/
   ├── tests/
   ├── package.json
   ├── railway.toml
   └── .env.example
   ```

3. Install dependencies:
   ```bash
   npm install express
   npm install @supabase/supabase-js
   npm install node-cron
   npm install axios
   npm install dotenv
   npm install winston  # for logging
   ```

4. Create `src/index.js`:
   - Express server on port 3000
   - Health check endpoint: `GET /health`
   - Error handling middleware
   - Graceful shutdown handling

5. Create `railway.toml`:
   ```toml
   [build]
   builder = "NIXPACKS"

   [deploy]
   startCommand = "node src/index.js"
   healthcheckPath = "/health"
   healthcheckTimeout = 100
   restartPolicyType = "ON_FAILURE"
   restartPolicyMaxRetries = 10
   ```

6. Configure environment variables in Railway dashboard:
   ```
   DATABASE_URL=<Supabase connection string>
   NODE_ENV=production
   PORT=3000
   SENTRY_DSN=<will be added later>
   ADMIN_CONSOLE_URL=https://admin-console-production.vercel.app
   BACKEND_API_URL=https://inboundai365-backend-production.up.railway.app
   ```

7. Deploy to Railway:
   ```bash
   npm install -g railway
   railway login
   railway link
   railway up
   ```

8. Verify deployment:
   - Check Railway dashboard shows service running
   - Test health endpoint: `curl https://<your-service>.railway.app/health`
   - Verify logs showing startup messages

**Acceptance Criteria:**
- ✅ Service deployed and accessible via public URL
- ✅ Health endpoint returns `{"status": "healthy", "timestamp": "..."}`
- ✅ Logs visible in Railway dashboard
- ✅ Service auto-restarts if crashed
- ✅ Uptime > 99.5%

**Evidence Required:**
- Railway deployment URL
- Screenshot of Railway dashboard showing service running
- Curl output of health check endpoint

---

### Task 2: Create 8 Database Tables in Supabase (6-8 hours)

**Objective:** Set up complete database schema with all 8 tables

**Steps:**

1. Enable pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

2. Create migration file: `migrations/001_create_tables.sql`

3. Create each table (SQL provided in Architecture doc, section 3):

**Table 1: error_knowledge**
```sql
CREATE TABLE error_knowledge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_id VARCHAR(20) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  error_message TEXT NOT NULL,
  error_type VARCHAR(50),
  category VARCHAR(50),
  application VARCHAR(100),
  solution_description TEXT NOT NULL,
  fix_code TEXT,
  fix_type VARCHAR(50),
  affected_files TEXT[],
  rollback_code TEXT,
  embedding vector(1536),
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  success_rate DECIMAL GENERATED ALWAYS AS (
    CASE WHEN (success_count + failure_count) > 0
      THEN success_count::DECIMAL / (success_count + failure_count)
      ELSE 0
    END
  ) STORED,
  last_used_at TIMESTAMP,
  last_successful_at TIMESTAMP,
  is_tested BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100),
  metadata JSONB
);

CREATE INDEX idx_error_knowledge_embedding ON error_knowledge
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_error_knowledge_category ON error_knowledge(category);
CREATE INDEX idx_error_knowledge_success_rate ON error_knowledge(success_rate DESC);
```

**Table 2: incidents**
```sql
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id VARCHAR(30) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'detected',
  severity VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  application VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  error_type VARCHAR(50),
  stack_trace TEXT,
  endpoint VARCHAR(500),
  context JSONB,
  error_knowledge_id UUID REFERENCES error_knowledge(id),
  root_cause_description TEXT,
  fix_description TEXT,
  detected_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  handled_by VARCHAR(50),
  agents_spawned TEXT[],
  time_to_resolution INTERVAL,
  actions_taken TEXT[],
  deployment_url VARCHAR(500),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_detected_at ON incidents(detected_at DESC);
CREATE INDEX idx_incidents_application ON incidents(application);
```

**Table 3: monitoring_checks**
```sql
CREATE TABLE monitoring_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_id VARCHAR(50) UNIQUE NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  check_type VARCHAR(50),
  target VARCHAR(255),
  application VARCHAR(100),
  status VARCHAR(20),
  http_status INTEGER,
  response_time_ms INTEGER,
  errors_detected INTEGER DEFAULT 0,
  error_details JSONB,
  incident_created UUID REFERENCES incidents(id)
);

CREATE INDEX idx_monitoring_checks_timestamp ON monitoring_checks(timestamp DESC);
CREATE INDEX idx_monitoring_checks_status ON monitoring_checks(status);
```

**Table 4: agent_actions**
```sql
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP DEFAULT NOW(),
  agent_id VARCHAR(100) NOT NULL,
  agent_type VARCHAR(50),
  action_type VARCHAR(100),
  action_description TEXT,
  action_success BOOLEAN,
  incident_id UUID REFERENCES incidents(id),
  error_knowledge_id UUID REFERENCES error_knowledge(id),
  safety_checks_passed BOOLEAN,
  action_details JSONB
);

CREATE INDEX idx_agent_actions_timestamp ON agent_actions(timestamp DESC);
CREATE INDEX idx_agent_actions_incident ON agent_actions(incident_id);
```

**Table 5: deployment_history**
```sql
CREATE TABLE deployment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deployment_id VARCHAR(50) UNIQUE NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  application VARCHAR(100),
  environment VARCHAR(20),
  status VARCHAR(50),
  incident_id UUID REFERENCES incidents(id),
  triggered_by VARCHAR(100),
  previous_version VARCHAR(100),
  new_version VARCHAR(100),
  commit_sha VARCHAR(100),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration INTERVAL,
  rollback_performed BOOLEAN DEFAULT false,
  tests_passed INTEGER,
  tests_failed INTEGER,
  deployment_logs TEXT
);

CREATE INDEX idx_deployment_history_timestamp ON deployment_history(timestamp DESC);
CREATE INDEX idx_deployment_history_status ON deployment_history(status);
```

**Table 6: security_events**
```sql
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id VARCHAR(50) UNIQUE NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  event_type VARCHAR(100),
  severity VARCHAR(20),
  status VARCHAR(50),
  source_ip VARCHAR(45),
  user_id VARCHAR(100),
  description TEXT,
  action_taken VARCHAR(100),
  incident_created UUID REFERENCES incidents(id),
  confidence_score DECIMAL,
  metadata JSONB
);

CREATE INDEX idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX idx_security_events_severity ON security_events(severity);
```

**Table 7: system_config**
```sql
CREATE TABLE system_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(100)
);

-- Seed initial configuration
INSERT INTO system_config (key, value, description) VALUES
  ('agent_kill_switch', '{"enabled": false}', 'Emergency stop for all agent operations'),
  ('agent_monitoring_enabled', '{"enabled": true}', 'Enable continuous monitoring'),
  ('agent_auto_fix_enabled', '{"enabled": false}', 'Enable auto-fix for known errors'),
  ('monitoring_interval_seconds', '{"value": 60}', 'Monitoring check interval'),
  ('max_deployments_per_hour', '{"value": 10}', 'Deployment rate limit'),
  ('require_human_approval_critical', '{"enabled": true}', 'Require approval for CRITICAL fixes'),
  ('notification_email', '{"email": "ryan@ib365.ai"}', 'CEO notification email'),
  ('deployment_window_start', '{"hour": 9}', 'Earliest deployment hour (24h format)'),
  ('deployment_window_end', '{"hour": 21}', 'Latest deployment hour (24h format)');
```

**Table 8: email_tracking**
```sql
CREATE TABLE email_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id VARCHAR(100) UNIQUE NOT NULL,
  incident_id UUID REFERENCES incidents(id),
  recipient VARCHAR(255),
  subject TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50),
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  first_clicked_at TIMESTAMP,
  click_count INTEGER DEFAULT 0,
  metadata JSONB
);

CREATE INDEX idx_email_tracking_incident ON email_tracking(incident_id);
CREATE INDEX idx_email_tracking_status ON email_tracking(status);
```

4. Run migration:
   - Use Supabase SQL Editor to execute migration
   - Verify all tables created
   - Verify all indexes created
   - Verify system_config seeded

5. Create database connection file `src/config/database.js`:
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.DATABASE_URL.split('@')[1].split('/')[0], // Extract URL
  process.env.SUPABASE_ANON_KEY,
  {
    db: { schema: 'public' },
    auth: { persistSession: false }
  }
);

module.exports = { supabase };
```

**Acceptance Criteria:**
- ✅ All 8 tables exist in Supabase with correct schema
- ✅ All indexes created
- ✅ pgvector extension enabled
- ✅ system_config table populated with initial values
- ✅ Foreign key constraints working
- ✅ Can insert/select from all tables
- ✅ Connection pooling configured

**Evidence Required:**
- SQL output showing all tables: `\dt` or `SELECT table_name FROM information_schema.tables WHERE table_schema='public';`
- Row count for system_config: `SELECT COUNT(*) FROM system_config;` (should be 9)
- Screenshot of Supabase table editor showing tables

---

### Task 3: Implement Sentry Webhook Endpoint (4-5 hours)

**Objective:** Create endpoint to receive Sentry error events

**Steps:**

1. Create `src/routes/error-reporting.js`:
```javascript
const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');
const { classifyError, generateIncidentId } = require('../services/error-classifier');
const { logAgentAction } = require('../utils/logger');

// POST /api/autonomous/error
router.post('/api/autonomous/error', async (req, res) => {
  try {
    const { error, context, severity, source } = req.body;

    // Validate input
    if (!error || !error.message) {
      return res.status(400).json({ error: 'Invalid error format' });
    }

    // Generate incident ID
    const incidentId = generateIncidentId();

    // Classify error
    const classification = classifyError(error, context);

    // Create incident
    const { data: incident, error: dbError } = await supabase
      .from('incidents')
      .insert({
        incident_id: incidentId,
        title: error.message.substring(0, 255),
        error_message: error.message,
        error_type: error.type || 'unknown',
        severity: severity || classification.severity,
        category: classification.category,
        application: context?.application || 'unknown',
        status: 'detected',
        stack_trace: error.stack,
        endpoint: context?.endpoint,
        context: context || {}
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ error: 'Failed to create incident' });
    }

    // Log action
    await logAgentAction({
      agent_id: 'monitoring-service',
      agent_type: 'monitoring',
      action_type: 'error_detected',
      action_description: `Error detected from ${source || 'unknown'}: ${error.message}`,
      action_success: true,
      incident_id: incident.id
    });

    console.log(`[INCIDENT CREATED] ${incidentId} - ${severity} - ${error.message.substring(0, 100)}`);

    res.json({
      incident_id: incidentId,
      created: true,
      severity: classification.severity,
      category: classification.category
    });

  } catch (err) {
    console.error('Error in /api/autonomous/error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

2. Create `src/services/error-classifier.js`:
```javascript
function classifyError(error, context) {
  const errorMessage = error.message.toLowerCase();

  // Severity classification rules
  const rules = {
    CRITICAL: [
      /database connection failed/i,
      /502 bad gateway/i,
      /authentication service down/i,
      /security breach/i,
      /data loss/i,
      /cannot connect to database/i
    ],
    HIGH: [
      /api timeout/i,
      /500 internal server error/i,
      /payment processing failed/i,
      /cannot read property/i,
      /syntax error/i,
      /undefined is not a function/i,
      /typeerror/i
    ],
    MEDIUM: [
      /slow query/i,
      /rate limit approaching/i,
      /cache miss/i,
      /timeout warning/i,
      /deprecation/i
    ],
    LOW: [
      /warning/i,
      /missing image/i,
      /404/i
    ]
  };

  let severity = 'MEDIUM'; // default
  for (const [level, patterns] of Object.entries(rules)) {
    if (patterns.some(p => p.test(errorMessage))) {
      severity = level;
      break;
    }
  }

  // Category inference
  let category = 'unknown';
  if (context?.endpoint || error.type?.includes('api')) category = 'backend';
  else if (context?.application?.includes('frontend')) category = 'frontend';
  else if (errorMessage.includes('db') || errorMessage.includes('database')) category = 'database';
  else if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) category = 'security';
  else if (errorMessage.includes('network') || errorMessage.includes('timeout')) category = 'infrastructure';

  return { severity, category };
}

function generateIncidentId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INC-${timestamp}-${random}`;
}

module.exports = { classifyError, generateIncidentId };
```

3. Create `src/utils/logger.js`:
```javascript
const { supabase } = require('../config/database');

async function logAgentAction(action) {
  try {
    await supabase.from('agent_actions').insert({
      agent_id: action.agent_id,
      agent_type: action.agent_type,
      action_type: action.action_type,
      action_description: action.action_description,
      action_success: action.action_success,
      incident_id: action.incident_id,
      error_knowledge_id: action.error_knowledge_id,
      safety_checks_passed: action.safety_checks_passed,
      action_details: action.action_details || {}
    });
  } catch (err) {
    console.error('Failed to log agent action:', err);
  }
}

module.exports = { logAgentAction };
```

4. Update `src/index.js` to include route:
```javascript
const errorReportingRoutes = require('./routes/error-reporting');
app.use(errorReportingRoutes);
```

5. Test endpoint:
```bash
curl -X POST https://<your-service>.railway.app/api/autonomous/error \
  -H "Content-Type: application/json" \
  -d '{
    "error": {
      "message": "Test error from curl",
      "type": "TestError",
      "stack": "Error: Test error\n    at test.js:10:5"
    },
    "context": {
      "application": "admin-console-frontend",
      "endpoint": "/api/test"
    },
    "severity": "HIGH",
    "source": "manual_test"
  }'
```

**Acceptance Criteria:**
- ✅ Endpoint accepts POST requests
- ✅ Validates input (returns 400 for invalid)
- ✅ Creates incident in database within 100ms
- ✅ Classifies severity correctly
- ✅ Classifies category correctly
- ✅ Returns incident_id in response
- ✅ Logs action to agent_actions table

**Evidence Required:**
- Curl output showing successful creation
- Database query showing incident created: `SELECT * FROM incidents ORDER BY detected_at DESC LIMIT 1;`
- Database query showing action logged: `SELECT * FROM agent_actions ORDER BY timestamp DESC LIMIT 1;`

---

### Task 4: Implement Health Check Service (4-6 hours)

**Objective:** Create automated health checks that run every 60 seconds

**Steps:**

1. Create `src/monitors/health-check.js`:
```javascript
const axios = require('axios');
const { supabase } = require('../config/database');
const { logAgentAction } = require('../utils/logger');

const healthChecks = [
  {
    name: 'backend',
    url: process.env.BACKEND_API_URL + '/health',
    application: 'admin-console-backend',
    timeout: 5000,
    expected_status: 200
  },
  {
    name: 'frontend',
    url: process.env.ADMIN_CONSOLE_URL,
    application: 'admin-console-frontend',
    timeout: 5000,
    expected_status: 200
  },
  {
    name: 'database',
    url: process.env.BACKEND_API_URL + '/health/db',
    application: 'database',
    timeout: 5000,
    expected_status: 200
  }
];

async function runHealthChecks() {
  console.log('[HEALTH CHECK] Starting health checks...');

  for (const check of healthChecks) {
    const startTime = Date.now();
    const checkId = `CHK-${Date.now()}-${check.name}`;

    try {
      const response = await axios.get(check.url, {
        timeout: check.timeout,
        validateStatus: () => true // Don't throw on non-200
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = response.status === check.expected_status;

      // Log check
      await supabase.from('monitoring_checks').insert({
        check_id: checkId,
        check_type: 'health',
        target: check.url,
        application: check.application,
        status: isHealthy ? 'healthy' : 'error',
        http_status: response.status,
        response_time_ms: responseTime,
        errors_detected: isHealthy ? 0 : 1
      });

      if (!isHealthy) {
        // Create incident for failed health check
        const { data: incident } = await supabase
          .from('incidents')
          .insert({
            incident_id: `INC-HEALTH-${Date.now()}`,
            title: `Health check failed: ${check.name}`,
            error_message: `${check.name} health check failed. Status: ${response.status}, Expected: ${check.expected_status}`,
            error_type: 'health_check_failure',
            severity: 'CRITICAL',
            category: 'infrastructure',
            application: check.application,
            status: 'detected',
            context: {
              check_name: check.name,
              url: check.url,
              http_status: response.status,
              response_time_ms: responseTime
            }
          })
          .select()
          .single();

        console.error(`[HEALTH CHECK FAILED] ${check.name} - Status: ${response.status}`);

        await logAgentAction({
          agent_id: 'health-monitor',
          agent_type: 'monitoring',
          action_type: 'health_check_failure',
          action_description: `Health check failed for ${check.name}`,
          action_success: false,
          incident_id: incident?.id
        });
      } else {
        console.log(`[HEALTH CHECK OK] ${check.name} - ${responseTime}ms`);
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Log failed check
      await supabase.from('monitoring_checks').insert({
        check_id: checkId,
        check_type: 'health',
        target: check.url,
        application: check.application,
        status: 'error',
        response_time_ms: responseTime,
        errors_detected: 1,
        error_details: {
          error: error.message,
          code: error.code
        }
      });

      // Create incident
      const { data: incident } = await supabase
        .from('incidents')
        .insert({
          incident_id: `INC-HEALTH-${Date.now()}`,
          title: `Health check failed: ${check.name}`,
          error_message: `${check.name} health check failed with error: ${error.message}`,
          error_type: 'health_check_failure',
          severity: 'CRITICAL',
          category: 'infrastructure',
          application: check.application,
          status: 'detected',
          context: {
            check_name: check.name,
            url: check.url,
            error: error.message,
            error_code: error.code
          }
        })
        .select()
        .single();

      console.error(`[HEALTH CHECK ERROR] ${check.name} - ${error.message}`);

      await logAgentAction({
        agent_id: 'health-monitor',
        agent_type: 'monitoring',
        action_type: 'health_check_failure',
        action_description: `Health check error for ${check.name}: ${error.message}`,
        action_success: false,
        incident_id: incident?.id
      });
    }
  }

  console.log('[HEALTH CHECK] Completed');
}

module.exports = { runHealthChecks };
```

2. Create `src/cron/monitoring-cron.js`:
```javascript
const cron = require('node-cron');
const { runHealthChecks } = require('../monitors/health-check');

function startMonitoring() {
  console.log('[CRON] Starting monitoring cron jobs...');

  // Run health checks every minute
  cron.schedule('* * * * *', async () => {
    try {
      await runHealthChecks();
    } catch (error) {
      console.error('[CRON ERROR] Health check failed:', error);
    }
  });

  console.log('[CRON] Monitoring cron jobs started');
}

module.exports = { startMonitoring };
```

3. Update `src/index.js` to start monitoring:
```javascript
const { startMonitoring } = require('./cron/monitoring-cron');

// Start monitoring after server starts
app.listen(PORT, () => {
  console.log(`Monitoring service running on port ${PORT}`);
  startMonitoring();
});
```

4. Test locally:
```bash
node src/index.js
# Wait 60 seconds, check logs for health checks
```

5. Deploy to Railway and monitor logs

**Acceptance Criteria:**
- ✅ Health checks run every 60 seconds (±5 seconds)
- ✅ All checks logged to monitoring_checks table
- ✅ Failed checks create incidents
- ✅ Response times < 5 seconds
- ✅ No memory leaks from cron jobs
- ✅ Graceful handling of timeouts
- ✅ Actions logged to agent_actions table

**Evidence Required:**
- Railway logs showing health checks running every minute
- Database query showing monitoring_checks: `SELECT COUNT(*) FROM monitoring_checks WHERE timestamp > NOW() - INTERVAL '5 minutes';`
- Screenshot of Railway logs
- Database query showing consistent intervals:
  ```sql
  SELECT
    timestamp,
    LAG(timestamp) OVER (ORDER BY timestamp) as prev,
    EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp))) as seconds_diff
  FROM monitoring_checks
  WHERE check_type = 'health'
  ORDER BY timestamp DESC
  LIMIT 10;
  ```

---

## ACCEPTANCE CRITERIA (Week 1 Backend Complete)

### Deployed & Running:
- ✅ Railway service deployed and accessible
- ✅ Service running 24/7 with auto-restart
- ✅ All 8 database tables created
- ✅ Sentry webhook endpoint operational
- ✅ Health checks running every 60 seconds

### Working Capabilities:
- ✅ Can receive and log errors from Sentry
- ✅ Errors classified by severity and category
- ✅ Incidents created within 100ms
- ✅ Health checks detect failures
- ✅ All actions logged to database

### Performance:
- ✅ Error detection latency < 60 seconds
- ✅ Database writes < 100ms
- ✅ Health check response times < 5 seconds
- ✅ No memory leaks
- ✅ Service uptime > 99.5%

### Testing:
- ✅ Can manually trigger test errors
- ✅ All database tables queryable
- ✅ Health checks logging correctly
- ✅ Cron jobs running on schedule

---

## DELIVERABLES

### Code Files:
1. `/autonomous-agent/src/index.js`
2. `/autonomous-agent/src/config/database.js`
3. `/autonomous-agent/src/routes/error-reporting.js`
4. `/autonomous-agent/src/routes/health.js`
5. `/autonomous-agent/src/services/error-classifier.js`
6. `/autonomous-agent/src/monitors/health-check.js`
7. `/autonomous-agent/src/cron/monitoring-cron.js`
8. `/autonomous-agent/src/utils/logger.js`
9. `/autonomous-agent/migrations/001_create_tables.sql`
10. `/autonomous-agent/package.json`
11. `/autonomous-agent/railway.toml`
12. `/autonomous-agent/.env.example`

### Documentation:
1. Deployment URL and credentials
2. Database verification queries
3. Test curl commands and outputs
4. Screenshots of Railway dashboard
5. Evidence of health checks running

### Database Evidence:
1. All 8 tables created: `\dt` output
2. system_config populated: `SELECT * FROM system_config;`
3. Sample incident: `SELECT * FROM incidents LIMIT 1;`
4. Health checks: `SELECT COUNT(*) FROM monitoring_checks;`
5. Agent actions: `SELECT COUNT(*) FROM agent_actions;`

---

## TIMELINE

**Day 1-2:**
- Task 1: Railway service (4-6 hours)
- Task 2: Database tables (6-8 hours)

**Day 3:**
- Task 3: Sentry webhook (4-5 hours)

**Day 4:**
- Task 4: Health checks (4-6 hours)

**Total:** 18-25 hours over 4 days

---

## NOTES

- Focus ONLY on monitoring and logging this week
- NO auto-fix logic yet (that's Week 3)
- Test everything thoroughly before marking complete
- Document any issues or blockers immediately
- Coordinate with PM if you need FE agent to start database setup

---

## CONTACT

**PM Coordinator:** Reports to Liaison
**Next Agent:** FE agent (starts after Task 2 complete)
**QA Agent:** Starts after all backend tasks complete

**Questions?** Update `/Users/riscentrdb/Desktop/autonomous-agent/CONTEXT/BE_PROGRESS.md` with blockers

---

## START NOW

**First task:** Task 1 - Create Railway monitoring service

**First milestone:** Railway service deployed (End of Day 1)

**GO! 🚀**
