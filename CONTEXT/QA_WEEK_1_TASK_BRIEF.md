# QA WEEK 1 TASKS - Autonomous Monitoring Agent

**Agent:** QA
**Week:** Week 1 - Foundation
**Duration:** 6-8 hours
**Priority:** HIGH - Week 1 Verification
**Status:** READY TO START (Wait for BE/FE completion)

---

## MISSION

Create comprehensive test suite for Week 1 deliverables. Verify all monitoring systems are working correctly, performance benchmarks are met, and the foundation is solid for Week 2+ features.

---

## DEPENDENCIES

**MUST WAIT FOR:**
- BE agent to complete all 4 tasks
- FE agent to complete all 3 tasks
- Railway service deployed
- Database tables created
- All monitoring systems running

**Before starting, verify:**
1. Railway service accessible
2. Health checks running (query database)
3. Playwright monitoring working
4. Security scanner operational

---

## REFERENCE DOCUMENTS

**MUST READ:**
- `/Users/riscentrdb/Desktop/liaison/AUTONOMOUS_AGENT_ARCHITECTURE.md`
  - Focus on: Section 10 (Testing Strategy)
- `/Users/riscentrdb/Desktop/liaison/AUTONOMOUS_AGENT_BUILD_PLAN.md`
  - Focus on: Week 1, QA Tasks (lines 380-438)
- BE Task Brief: `/Users/riscentrdb/Desktop/autonomous-agent/CONTEXT/BE_WEEK_1_TASK_BRIEF.md`
- FE Task Brief: `/Users/riscentrdb/Desktop/autonomous-agent/CONTEXT/FE_WEEK_1_TASK_BRIEF.md`

**Project Location:** `/Users/riscentrdb/Desktop/autonomous-agent`

---

## TASKS

### Task 1: Create Week 1 Test Plan (2 hours)

**Objective:** Document comprehensive testing strategy for Week 1

**Steps:**

1. Create test plan document: `/autonomous-agent/tests/WEEK_1_TEST_PLAN.md`

**Test Plan Contents:**

```markdown
# Week 1 Test Plan - Autonomous Monitoring Agent

## Scope
Test all Week 1 deliverables:
- Railway monitoring service
- Database schema
- Sentry webhook endpoint
- Health check service
- Playwright browser monitoring
- Security scanner
- Manual trigger endpoints

## Test Categories
1. Unit Tests - Individual functions
2. Integration Tests - Component interaction
3. Performance Tests - Speed/latency benchmarks
4. E2E Tests - Full monitoring flow
5. Reliability Tests - Uptime/stability

## Success Criteria
- All tests passing
- Coverage > 80%
- Performance benchmarks met
- No critical bugs
- Documentation complete

## Test Schedule
- Day 5: Setup + Unit tests
- Day 6: Integration + Performance tests
- Day 7: E2E + Documentation

## Test Environment
- Staging Railway service
- Staging Supabase database
- Local Playwright execution
- Staging admin console URLs
```

2. Define test cases for each component

3. Create test data fixtures

**Acceptance Criteria:**
- ✅ Test plan documented
- ✅ All test cases defined
- ✅ Test data prepared
- ✅ Schedule clear

---

### Task 2: Create Unit & Integration Tests (4-6 hours)

**Objective:** Build automated test suite

**Steps:**

1. Install testing dependencies:
```bash
cd /Users/riscentrdb/Desktop/autonomous-agent
npm install --save-dev jest supertest
npm install --save-dev @playwright/test
```

2. Create `tests/setup.js`:
```javascript
const { createClient } = require('@supabase/supabase-js');

// Test database connection
global.testDb = createClient(
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Cleanup function
global.cleanup = async () => {
  // Delete test data
  await global.testDb.from('incidents').delete().like('incident_id', 'INC-TEST%');
  await global.testDb.from('monitoring_checks').delete().like('check_id', 'CHK-TEST%');
};
```

3. Create `tests/week-1-integration.test.js`:
```javascript
const request = require('supertest');
const { supabase } = require('../src/config/database');

describe('Week 1 Integration Tests', () => {

  describe('Error Detection Latency', () => {
    test('Error detection < 60 seconds', async () => {
      const startTime = Date.now();

      // Create test error
      const response = await request('http://localhost:3000')
        .post('/api/autonomous/error')
        .send({
          error: { message: 'Test error for latency', type: 'TestError' },
          severity: 'HIGH',
          source: 'test'
        });

      const elapsed = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.incident_id).toBeDefined();
      expect(elapsed).toBeLessThan(60000);

      console.log(`✓ Detection latency: ${elapsed}ms`);
    }, 65000);
  });

  describe('Health Checks', () => {
    test('Health checks run every 60 seconds', async () => {
      // Wait for 2 minutes to collect data
      await new Promise(resolve => setTimeout(resolve, 120000));

      const { data: checks } = await supabase
        .from('monitoring_checks')
        .select('*')
        .eq('check_type', 'health')
        .gte('timestamp', new Date(Date.now() - 120000).toISOString())
        .order('timestamp', { ascending: true });

      expect(checks.length).toBeGreaterThanOrEqual(2);

      // Calculate intervals
      const intervals = [];
      for (let i = 1; i < checks.length; i++) {
        const diff = new Date(checks[i].timestamp) - new Date(checks[i-1].timestamp);
        intervals.push(diff / 1000); // seconds
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      expect(avgInterval).toBeGreaterThan(50);  // At least 50 seconds
      expect(avgInterval).toBeLessThan(70);     // At most 70 seconds

      console.log(`✓ Average interval: ${avgInterval.toFixed(1)}s`);
    }, 130000);
  });

  describe('Database Operations', () => {
    test('Incident creation < 100ms', async () => {
      const start = Date.now();

      const { data, error } = await supabase
        .from('incidents')
        .insert({
          incident_id: `INC-TEST-${Date.now()}`,
          title: 'Test incident',
          error_message: 'Test error message',
          error_type: 'test',
          severity: 'MEDIUM',
          category: 'test',
          application: 'test',
          status: 'detected'
        })
        .select()
        .single();

      const elapsed = Date.now() - start;

      expect(error).toBeNull();
      expect(data.id).toBeDefined();
      expect(elapsed).toBeLessThan(100);

      console.log(`✓ DB write latency: ${elapsed}ms`);
    });

    test('All 8 tables exist', async () => {
      const tables = [
        'error_knowledge',
        'incidents',
        'monitoring_checks',
        'agent_actions',
        'deployment_history',
        'security_events',
        'system_config',
        'email_tracking'
      ];

      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        expect(error).toBeNull();
        console.log(`✓ Table exists: ${table}`);
      }
    });
  });

  describe('Sentry Webhook', () => {
    test('Creates incident correctly', async () => {
      const testError = {
        error: {
          message: 'TypeError: Cannot read property foo of undefined',
          type: 'TypeError',
          stack: 'TypeError: Cannot read property...\n  at file.js:10:5'
        },
        context: {
          application: 'admin-console-frontend',
          endpoint: '/api/test'
        },
        severity: 'HIGH',
        source: 'sentry'
      };

      const response = await request('http://localhost:3000')
        .post('/api/autonomous/error')
        .send(testError);

      expect(response.status).toBe(200);
      expect(response.body.incident_id).toBeDefined();
      expect(response.body.severity).toBe('HIGH');

      // Verify in database
      const { data: incident } = await supabase
        .from('incidents')
        .select('*')
        .eq('incident_id', response.body.incident_id)
        .single();

      expect(incident.error_message).toContain('TypeError');
      expect(incident.category).toBe('frontend');
      console.log(`✓ Incident created: ${incident.incident_id}`);
    });
  });

  describe('Browser Monitoring', () => {
    test('Playwright checks logged to database', async () => {
      const { data: checks } = await supabase
        .from('monitoring_checks')
        .select('*')
        .eq('check_type', 'browser')
        .gte('timestamp', new Date(Date.now() - 600000).toISOString()) // last 10 min
        .order('timestamp', { ascending: false });

      expect(checks.length).toBeGreaterThan(0);

      const check = checks[0];
      expect(check.application).toBe('admin-console-frontend');
      expect(check.target).toBeDefined();
      expect(check.status).toBeDefined();

      console.log(`✓ Browser checks found: ${checks.length}`);
    });
  });

  describe('Manual Triggers', () => {
    test('Manual test error creation works', async () => {
      const response = await request('http://localhost:3000')
        .post('/api/autonomous/trigger-test-error')
        .send({
          error_type: 'manual_test',
          severity: 'LOW',
          message: 'Manual test error from QA suite'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.incident_id).toMatch(/^INC-TEST-/);

      console.log(`✓ Manual trigger works: ${response.body.incident_id}`);
    });

    test('Status endpoint returns correct data', async () => {
      const response = await request('http://localhost:3000')
        .get('/api/autonomous/status');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('operational');
      expect(response.body.last_hour_stats).toBeDefined();
      expect(response.body.recent_incidents).toBeDefined();

      console.log(`✓ Status endpoint working`);
      console.log(`  Checks: ${response.body.last_hour_stats.total_checks}`);
      console.log(`  Incidents: ${response.body.last_hour_stats.total_incidents}`);
    });
  });
});
```

4. Create `tests/performance.test.js`:
```javascript
const request = require('supertest');

describe('Performance Tests', () => {

  test('Health check response time < 5 seconds', async () => {
    const start = Date.now();

    const response = await request(process.env.RAILWAY_URL || 'http://localhost:3000')
      .get('/health')
      .timeout(10000);

    const elapsed = Date.now() - start;

    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(5000);

    console.log(`✓ Health check: ${elapsed}ms`);
  });

  test('Error endpoint handles 100 concurrent requests', async () => {
    const requests = [];

    for (let i = 0; i < 100; i++) {
      requests.push(
        request('http://localhost:3000')
          .post('/api/autonomous/error')
          .send({
            error: { message: `Load test error ${i}`, type: 'LoadTest' },
            severity: 'LOW',
            source: 'load_test'
          })
      );
    }

    const start = Date.now();
    const responses = await Promise.all(requests);
    const elapsed = Date.now() - start;

    const successCount = responses.filter(r => r.status === 200).length;

    expect(successCount).toBe(100);
    expect(elapsed).toBeLessThan(10000); // 10 seconds for 100 requests

    console.log(`✓ Handled 100 concurrent requests in ${elapsed}ms`);
  });

  test('No memory leaks from repeated Playwright runs', async () => {
    const { monitorBrowserErrors } = require('../src/monitors/browser-monitor');

    const initialMemory = process.memoryUsage().heapUsed;

    // Run 5 times
    for (let i = 0; i < 5; i++) {
      await monitorBrowserErrors();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const growth = finalMemory - initialMemory;
    const growthMB = growth / 1024 / 1024;

    // Memory should not grow more than 50MB
    expect(growthMB).toBeLessThan(50);

    console.log(`✓ Memory growth: ${growthMB.toFixed(2)} MB`);
  }, 60000);
});
```

5. Update `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "testTimeout": 30000,
    "setupFilesAfterEnv": ["./tests/setup.js"]
  }
}
```

6. Run tests:
```bash
npm test
```

**Acceptance Criteria:**
- ✅ All tests passing
- ✅ Test coverage > 80%
- ✅ Performance benchmarks met
- ✅ No flaky tests
- ✅ Tests documented

**Evidence Required:**
- Test output showing all passing
- Coverage report
- Performance benchmark results

---

### Task 3: Create Test Documentation & Report (2 hours)

**Objective:** Document test results and create Week 1 verification report

**Steps:**

1. Run full test suite and capture output

2. Generate coverage report:
```bash
npm run test:coverage
```

3. Create `tests/WEEK_1_TEST_RESULTS.md`:
```markdown
# Week 1 Test Results

**Date:** November 10, 2025
**Tested By:** QA Agent
**Status:** ✅ PASS

## Summary
- Total Tests: 15
- Passed: 15
- Failed: 0
- Coverage: 84%

## Performance Benchmarks
- Error detection latency: 45ms ✅
- Health check interval: 60.2s ✅
- Database write speed: 78ms ✅
- API response time: 120ms ✅
- Concurrent load: 100 req in 3.2s ✅

## Component Verification
### Backend
- ✅ Railway service deployed
- ✅ All 8 database tables created
- ✅ Sentry webhook working
- ✅ Health checks running every 60s

### Frontend
- ✅ Playwright monitoring working
- ✅ Browser errors detected
- ✅ Screenshots captured
- ✅ Security scanner operational

### Integration
- ✅ End-to-end error flow working
- ✅ Database logging correct
- ✅ No memory leaks
- ✅ Manual triggers working

## Issues Found
None critical. Minor observations:
- Health check interval variance ±5 seconds (acceptable)
- Browser check takes 90 seconds for 5 pages (acceptable)

## Recommendation
✅ **APPROVED FOR WEEK 2**
All Week 1 deliverables verified and working correctly.
```

4. Create verification checklist: `tests/WEEK_1_VERIFICATION_CHECKLIST.md`

5. Take screenshots of:
   - Railway dashboard showing service running
   - Database tables with data
   - Test output
   - Monitoring logs

**Acceptance Criteria:**
- ✅ All tests documented
- ✅ Results captured
- ✅ Issues logged
- ✅ Recommendation provided

---

## FINAL DELIVERABLES

### Test Files:
1. `/autonomous-agent/tests/WEEK_1_TEST_PLAN.md`
2. `/autonomous-agent/tests/week-1-integration.test.js`
3. `/autonomous-agent/tests/performance.test.js`
4. `/autonomous-agent/tests/setup.js`
5. `/autonomous-agent/tests/WEEK_1_TEST_RESULTS.md`
6. `/autonomous-agent/tests/WEEK_1_VERIFICATION_CHECKLIST.md`

### Evidence:
1. Test output showing all passing
2. Coverage report (>80%)
3. Performance benchmarks
4. Screenshots
5. Verification checklist

---

## ACCEPTANCE CRITERIA (Week 1 QA Complete)

- ✅ All 15+ tests passing
- ✅ Coverage > 80%
- ✅ Performance benchmarks met
- ✅ No critical issues
- ✅ Documentation complete
- ✅ Week 2 approved

---

## TIMELINE

**Day 5:**
- Task 1: Test plan (2 hours)
- Task 2 (Part 1): Unit tests (2 hours)

**Day 6:**
- Task 2 (Part 2): Integration + Performance tests (2-4 hours)

**Day 7:**
- Task 3: Documentation + Report (2 hours)

**Total:** 6-8 hours over 3 days

---

## NOTES

- Wait for BE and FE to complete before starting
- Run tests against staging environment
- Document any issues immediately
- Coordinate with PM for final sign-off

---

## CONTACT

**PM Coordinator:** Reports to Liaison
**Dependencies:** BE + FE agents complete
**Output:** Week 1 verification report

**Questions?** Update `/Users/riscentrdb/Desktop/autonomous-agent/CONTEXT/QA_PROGRESS.md`

---

## START

**Wait for:** BE + FE task completion
**First task:** Task 1 - Create test plan
**Final deliverable:** Week 1 verification report

**READY TO VERIFY! ✓**
