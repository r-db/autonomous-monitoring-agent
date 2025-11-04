-- Autonomous Monitoring Agent - Database Schema
-- Week 1 Foundation
-- Created: November 4, 2025

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- TABLE 1: error_knowledge
-- Purpose: Store known errors and solutions for RAG-based auto-fixing
-- =============================================================================
CREATE TABLE IF NOT EXISTS error_knowledge (
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

-- Indexes for error_knowledge
CREATE INDEX IF NOT EXISTS idx_error_knowledge_embedding ON error_knowledge
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_error_knowledge_category ON error_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_error_knowledge_success_rate ON error_knowledge(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_error_knowledge_application ON error_knowledge(application);

-- =============================================================================
-- TABLE 2: incidents
-- Purpose: Track all detected incidents throughout their lifecycle
-- =============================================================================
CREATE TABLE IF NOT EXISTS incidents (
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

-- Indexes for incidents
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_detected_at ON incidents(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_application ON incidents(application);
CREATE INDEX IF NOT EXISTS idx_incidents_incident_id ON incidents(incident_id);

-- =============================================================================
-- TABLE 3: monitoring_checks
-- Purpose: Log every health check and monitoring operation
-- =============================================================================
CREATE TABLE IF NOT EXISTS monitoring_checks (
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

-- Indexes for monitoring_checks
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_timestamp ON monitoring_checks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_status ON monitoring_checks(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_application ON monitoring_checks(application);

-- =============================================================================
-- TABLE 4: agent_actions
-- Purpose: Complete audit trail of all agent operations
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_actions (
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

-- Indexes for agent_actions
CREATE INDEX IF NOT EXISTS idx_agent_actions_timestamp ON agent_actions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_actions_incident ON agent_actions(incident_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_agent_id ON agent_actions(agent_id);

-- =============================================================================
-- TABLE 5: deployment_history
-- Purpose: Track all autonomous deployments
-- =============================================================================
CREATE TABLE IF NOT EXISTS deployment_history (
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

-- Indexes for deployment_history
CREATE INDEX IF NOT EXISTS idx_deployment_history_timestamp ON deployment_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_history_status ON deployment_history(status);
CREATE INDEX IF NOT EXISTS idx_deployment_history_application ON deployment_history(application);

-- =============================================================================
-- TABLE 6: security_events
-- Purpose: Track security-related incidents and anomalies
-- =============================================================================
CREATE TABLE IF NOT EXISTS security_events (
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

-- Indexes for security_events
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);

-- =============================================================================
-- TABLE 7: system_config
-- Purpose: Agent configuration and feature flags (kill switch, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS system_config (
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
  ('agent_auto_fix_enabled', '{"enabled": false}', 'Enable auto-fix for known errors (Week 3+)'),
  ('monitoring_interval_seconds', '{"value": 60}', 'Monitoring check interval'),
  ('max_deployments_per_hour', '{"value": 10}', 'Deployment rate limit'),
  ('require_human_approval_critical', '{"enabled": true}', 'Require approval for CRITICAL fixes'),
  ('notification_email', '{"email": "ryan@ib365.ai"}', 'CEO notification email'),
  ('deployment_window_start', '{"hour": 9}', 'Earliest deployment hour (24h format)'),
  ('deployment_window_end', '{"hour": 21}', 'Latest deployment hour (24h format)')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- TABLE 8: email_tracking
-- Purpose: Track CEO notification delivery and engagement
-- =============================================================================
CREATE TABLE IF NOT EXISTS email_tracking (
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

-- Indexes for email_tracking
CREATE INDEX IF NOT EXISTS idx_email_tracking_incident ON email_tracking(incident_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_status ON email_tracking(status);
CREATE INDEX IF NOT EXISTS idx_email_tracking_sent_at ON email_tracking(sent_at DESC);

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify all tables exist
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
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
  );

  IF table_count = 8 THEN
    RAISE NOTICE '✅ All 8 tables created successfully';
  ELSE
    RAISE NOTICE '❌ Only % tables found. Expected 8.', table_count;
  END IF;
END $$;

-- Verify system_config seeded
DO $$
DECLARE
  config_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO config_count FROM system_config;

  IF config_count >= 9 THEN
    RAISE NOTICE '✅ System configuration seeded (% entries)', config_count;
  ELSE
    RAISE NOTICE '❌ System configuration incomplete. Found % entries, expected 9.', config_count;
  END IF;
END $$;

-- Display table summary
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
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

-- Display system configuration
SELECT key, value, description
FROM system_config
ORDER BY key;
