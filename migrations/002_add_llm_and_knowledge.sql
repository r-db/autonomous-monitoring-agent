-- Migration: Add LLM configuration and enhance knowledge base
-- Date: 2025-11-05
-- Description: Adds LLM provider config, updates error_knowledge schema, adds fix tracking

-- Add LLM configuration to system_config
INSERT INTO system_config (key, value, description) VALUES
  ('active_llm_provider', '{"provider": "claude"}', 'Active LLM provider (claude/openai)'),
  ('llm_model_config', '{
    "claude": {
      "model": "claude-3-5-sonnet-20241022",
      "maxTokens": 8192,
      "temperature": 0.7
    },
    "openai": {
      "model": "gpt-4-turbo-preview",
      "maxTokens": 4096,
      "temperature": 0.7
    }
  }', 'LLM model configuration per provider')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- Update error_knowledge table for better RAG
ALTER TABLE error_knowledge
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS resolution_steps TEXT[],
  ADD COLUMN IF NOT EXISTS code_fix JSONB;

-- Add unique constraint on source_url for documentation
CREATE UNIQUE INDEX IF NOT EXISTS error_knowledge_source_url_idx
  ON error_knowledge(source_url)
  WHERE source_url IS NOT NULL;

-- Add fix_attempts table to track all fix attempts
CREATE TABLE IF NOT EXISTS fix_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id VARCHAR(50) NOT NULL REFERENCES incidents(incident_id),
  attempted_at TIMESTAMP DEFAULT NOW(),
  llm_provider VARCHAR(50) NOT NULL,
  fix_plan JSONB NOT NULL,
  execution_result JSONB,
  verification_result JSONB,
  success BOOLEAN,
  rolled_back BOOLEAN DEFAULT FALSE,
  execution_time_ms INTEGER,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS fix_attempts_incident_idx ON fix_attempts(incident_id);
CREATE INDEX IF NOT EXISTS fix_attempts_attempted_at_idx ON fix_attempts(attempted_at DESC);
CREATE INDEX IF NOT EXISTS fix_attempts_success_idx ON fix_attempts(success);

-- Add llm_queries table to track all LLM API calls
CREATE TABLE IF NOT EXISTS llm_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_id VARCHAR(100) UNIQUE NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  latency_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  incident_id VARCHAR(50),
  query_type VARCHAR(50),
  context JSONB
);

CREATE INDEX IF NOT EXISTS llm_queries_created_at_idx ON llm_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS llm_queries_provider_idx ON llm_queries(provider);
CREATE INDEX IF NOT EXISTS llm_queries_incident_idx ON llm_queries(incident_id);

-- Add knowledge_updates table to track documentation ingestion
CREATE TABLE IF NOT EXISTS knowledge_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  update_type VARCHAR(50) NOT NULL, -- 'scheduled', 'manual', 'triggered'
  source VARCHAR(100) NOT NULL,
  documents_updated INTEGER DEFAULT 0,
  documents_added INTEGER DEFAULT 0,
  documents_failed INTEGER DEFAULT 0,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed'
  error_message TEXT,
  details JSONB
);

CREATE INDEX IF NOT EXISTS knowledge_updates_started_at_idx ON knowledge_updates(started_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_updates_status_idx ON knowledge_updates(status);

-- Update incidents table with fix tracking
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS fix_attempted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fix_attempts_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_fix_attempt TIMESTAMP;

-- Create view for incident analysis
CREATE OR REPLACE VIEW incident_analytics AS
SELECT
  i.incident_id,
  i.title,
  i.error_type,
  i.severity,
  i.category,
  i.status,
  i.detected_at,
  i.resolved_at,
  i.fix_attempted,
  i.fix_attempts_count,
  EXTRACT(EPOCH FROM (i.resolved_at - i.detected_at)) / 60 as resolution_time_minutes,
  COUNT(fa.id) as actual_fix_attempts,
  BOOL_OR(fa.success) as fix_succeeded
FROM incidents i
LEFT JOIN fix_attempts fa ON i.incident_id = fa.incident_id
GROUP BY i.incident_id, i.title, i.error_type, i.severity, i.category,
         i.status, i.detected_at, i.resolved_at, i.fix_attempted, i.fix_attempts_count;

-- Create view for LLM usage analytics
CREATE OR REPLACE VIEW llm_usage_analytics AS
SELECT
  provider,
  model,
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as queries,
  SUM(prompt_tokens) as total_prompt_tokens,
  SUM(completion_tokens) as total_completion_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost,
  AVG(latency_ms) as avg_latency_ms
FROM llm_queries
GROUP BY provider, model, DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Grant necessary permissions (if using role-based access)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO monitoring_agent;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO monitoring_agent;

COMMIT;
