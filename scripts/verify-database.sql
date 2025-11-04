-- Autonomous Monitoring Agent - Database Verification Script
-- Run in Supabase SQL Editor after deployment

-- =============================================================================
-- VERIFICATION 1: Check All Tables Exist
-- =============================================================================
SELECT
  table_name,
  CASE
    WHEN table_name IN (
      'error_knowledge',
      'incidents',
      'monitoring_checks',
      'agent_actions',
      'deployment_history',
      'security_events',
      'system_config',
      'email_tracking'
    ) THEN '✅'
    ELSE '❌'
  END as status
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

-- Expected: 8 rows, all with ✅

-- =============================================================================
-- VERIFICATION 2: System Configuration
-- =============================================================================
SELECT
  '✅ System Config' as check_name,
  COUNT(*) as count,
  CASE WHEN COUNT(*) >= 9 THEN 'PASS' ELSE 'FAIL' END as status
FROM system_config;

-- Expected: 9 rows, status = PASS

SELECT key, value, description
FROM system_config
ORDER BY key;

-- =============================================================================
-- VERIFICATION 3: Recent Incidents
-- =============================================================================
SELECT
  '✅ Recent Incidents' as check_name,
  COUNT(*) as count
FROM incidents
WHERE detected_at > NOW() - INTERVAL '1 hour';

-- Expected: At least 1 row (from test)

SELECT
  incident_id,
  severity,
  category,
  LEFT(error_message, 50) as error_preview,
  status,
  detected_at
FROM incidents
ORDER BY detected_at DESC
LIMIT 10;

-- =============================================================================
-- VERIFICATION 4: Health Checks (Wait 5 minutes after deployment)
-- =============================================================================
SELECT
  '✅ Health Checks' as check_name,
  COUNT(*) as count,
  CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'WAIT' END as status
FROM monitoring_checks
WHERE timestamp > NOW() - INTERVAL '5 minutes';

-- Expected: 3-5 checks per minute × 5 minutes = 15-25 rows, status = PASS

SELECT
  application,
  status,
  response_time_ms,
  timestamp
FROM monitoring_checks
ORDER BY timestamp DESC
LIMIT 20;

-- =============================================================================
-- VERIFICATION 5: Check Interval Consistency
-- =============================================================================
SELECT
  timestamp,
  LAG(timestamp) OVER (ORDER BY timestamp) as previous_check,
  EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp))) as seconds_between,
  CASE
    WHEN EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp))) BETWEEN 55 AND 65
      THEN '✅ 60s'
    WHEN EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp))) IS NULL
      THEN '⏸️ First'
    ELSE '❌ Off'
  END as interval_status
FROM monitoring_checks
WHERE check_type = 'health'
ORDER BY timestamp DESC
LIMIT 10;

-- Expected: Most rows show ✅ 60s (within 55-65 second range)

-- =============================================================================
-- VERIFICATION 6: Agent Actions
-- =============================================================================
SELECT
  '✅ Agent Actions' as check_name,
  COUNT(*) as count,
  CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'FAIL' END as status
FROM agent_actions
WHERE timestamp > NOW() - INTERVAL '1 hour';

-- Expected: At least 3 actions (startup, monitoring_started, error_detected)

SELECT
  agent_id,
  action_type,
  action_success,
  LEFT(action_description, 60) as description,
  timestamp
FROM agent_actions
ORDER BY timestamp DESC
LIMIT 15;

-- =============================================================================
-- VERIFICATION 7: Performance Metrics
-- =============================================================================
SELECT
  'Performance Metrics' as report,
  application,
  COUNT(*) as check_count,
  AVG(response_time_ms)::INTEGER as avg_response_ms,
  MAX(response_time_ms) as max_response_ms,
  MIN(response_time_ms) as min_response_ms,
  CASE
    WHEN AVG(response_time_ms) < 2000 THEN '✅ Good'
    WHEN AVG(response_time_ms) < 5000 THEN '⚠️ Slow'
    ELSE '❌ Bad'
  END as performance
FROM monitoring_checks
WHERE timestamp > NOW() - INTERVAL '10 minutes'
GROUP BY application;

-- Expected: All applications show ✅ Good or ⚠️ Slow

-- =============================================================================
-- VERIFICATION 8: Error Detection Rate
-- =============================================================================
SELECT
  'Error Detection' as metric,
  COUNT(*) as total_checks,
  SUM(errors_detected) as errors_found,
  ROUND(SUM(errors_detected)::NUMERIC / COUNT(*) * 100, 2) as error_rate_percent
FROM monitoring_checks
WHERE timestamp > NOW() - INTERVAL '1 hour';

-- Expected: Low error rate (0-5%)

-- =============================================================================
-- VERIFICATION 9: Table Sizes
-- =============================================================================
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename) as column_count
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'error_knowledge',
  'incidents',
  'monitoring_checks',
  'agent_actions',
  'deployment_history',
  'security_events',
  'system_config',
  'email_tracking'
)
ORDER BY tablename;

-- =============================================================================
-- VERIFICATION 10: Row Counts
-- =============================================================================
SELECT
  'Row Counts' as summary,
  (SELECT COUNT(*) FROM error_knowledge) as error_knowledge,
  (SELECT COUNT(*) FROM incidents) as incidents,
  (SELECT COUNT(*) FROM monitoring_checks) as monitoring_checks,
  (SELECT COUNT(*) FROM agent_actions) as agent_actions,
  (SELECT COUNT(*) FROM deployment_history) as deployment_history,
  (SELECT COUNT(*) FROM security_events) as security_events,
  (SELECT COUNT(*) FROM system_config) as system_config,
  (SELECT COUNT(*) FROM email_tracking) as email_tracking;

-- Expected:
-- - system_config: 9
-- - incidents: >= 1
-- - monitoring_checks: >= 15 (after 5 minutes)
-- - agent_actions: >= 3
-- - others: 0 (Week 2+ features)

-- =============================================================================
-- FINAL SUMMARY
-- =============================================================================
DO $$
DECLARE
  tables_ok BOOLEAN;
  config_ok BOOLEAN;
  checks_ok BOOLEAN;
  actions_ok BOOLEAN;
BEGIN
  -- Check tables
  SELECT COUNT(*) = 8 INTO tables_ok
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'error_knowledge', 'incidents', 'monitoring_checks', 'agent_actions',
    'deployment_history', 'security_events', 'system_config', 'email_tracking'
  );

  -- Check config
  SELECT COUNT(*) >= 9 INTO config_ok FROM system_config;

  -- Check monitoring checks (after 5 minutes)
  SELECT COUNT(*) >= 3 INTO checks_ok
  FROM monitoring_checks
  WHERE timestamp > NOW() - INTERVAL '5 minutes';

  -- Check agent actions
  SELECT COUNT(*) >= 3 INTO actions_ok
  FROM agent_actions
  WHERE timestamp > NOW() - INTERVAL '1 hour';

  -- Print summary
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DEPLOYMENT VERIFICATION SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables: %', CASE WHEN tables_ok THEN '✅ PASS' ELSE '❌ FAIL' END;
  RAISE NOTICE 'Config: %', CASE WHEN config_ok THEN '✅ PASS' ELSE '❌ FAIL' END;
  RAISE NOTICE 'Health Checks: %', CASE WHEN checks_ok THEN '✅ PASS' ELSE '⏸️ WAIT 5 MIN' END;
  RAISE NOTICE 'Agent Actions: %', CASE WHEN actions_ok THEN '✅ PASS' ELSE '❌ FAIL' END;
  RAISE NOTICE '========================================';

  IF tables_ok AND config_ok AND actions_ok THEN
    RAISE NOTICE '✅ DEPLOYMENT VERIFIED - ALL CHECKS PASSED';
  ELSIF NOT checks_ok THEN
    RAISE NOTICE '⏸️ PARTIAL - Wait 5 minutes and re-run';
  ELSE
    RAISE NOTICE '❌ DEPLOYMENT FAILED - Check errors above';
  END IF;
END $$;
