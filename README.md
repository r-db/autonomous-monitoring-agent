# Autonomous Monitoring & Security Agent

**Status:** Week 1 Foundation Complete ✅
**Version:** 1.0.0-week1
**Build Date:** November 4, 2025

---

## Overview

The Autonomous Monitoring & Security Agent is a production-grade system that continuously monitors applications for errors, auto-remediates known issues, and coordinates agent teams for unknown problems.

**Week 1 deliverable:** Backend foundation with monitoring and incident detection.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              AUTONOMOUS MONITORING AGENT                     │
│                  (Railway Service)                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐        ┌──────────────────┐           │
│  │  Express Server  │        │  Cron Scheduler  │           │
│  │  (Port 3000)     │        │  (Every 60s)     │           │
│  └──────────────────┘        └──────────────────┘           │
│           │                           │                      │
│           │                           │                      │
│  ┌────────┴───────────────────────────┴────────────┐        │
│  │           Health Check Monitor                  │        │
│  │  - Backend API health                           │        │
│  │  - Frontend health                              │        │
│  │  - Database health                              │        │
│  └─────────────────────────────────────────────────┘        │
│           │                           │                      │
│           ↓                           ↓                      │
│  ┌──────────────────┐        ┌──────────────────┐           │
│  │ Error Reporting  │        │ Incident Tracker │           │
│  │ (Sentry webhook) │        │ (Database)       │           │
│  └──────────────────┘        └──────────────────┘           │
│                                                               │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ↓
                    ┌──────────────────────┐
                    │  Supabase Database   │
                    │  - 8 tables          │
                    │  - pgvector enabled  │
                    └──────────────────────┘
```

---

## Features (Week 1)

### ✅ Monitoring
- Health checks every 60 seconds
- Checks backend API, frontend, and database
- Response time tracking
- Automatic failure detection

### ✅ Error Reporting
- Receive errors from Sentry webhooks
- Manual error submission API
- Automatic severity classification (CRITICAL, HIGH, MEDIUM, LOW)
- Category inference (backend, frontend, database, security, infrastructure)

### ✅ Incident Management
- Automatic incident creation
- Complete incident lifecycle tracking
- Incident search and retrieval
- Time-to-resolution metrics

### ✅ Audit Trail
- All agent actions logged
- Complete action history
- Success/failure tracking
- Timestamped records

### ✅ Database Foundation
- 8 tables created (Week 1-5 ready)
- pgvector extension for RAG (Week 2+)
- System configuration with feature flags
- Optimized indexes for performance

---

## Security

### Authentication

All `/api/autonomous/*` endpoints require API key authentication:

```bash
# Include API key in x-api-key header
curl -H "x-api-key: your-api-key" https://your-service.railway.app/api/autonomous/trigger
```

Health endpoints (`/health`, `/status`) do NOT require authentication.

### Rate Limiting

- General API: 100 requests per 15 minutes
- Error creation: 50 requests per 5 minutes
- Manual triggers: 5 requests per minute

### Security Features

- Helmet.js security headers
- CORS protection (configurable origins)
- Input validation (express-validator)
- Body size limit: 100KB
- Environment variable validation

## API Endpoints

### Health & Status (No Auth Required)

**GET /health**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-04T...",
  "uptime": 123.45,
  "database": "connected"
}
```

**GET /status**
```json
{
  "agent_enabled": true,
  "monitoring_active": true,
  "auto_fix_enabled": false,
  "database_connected": true,
  "uptime_seconds": 3600,
  "version": "1.0.0-week1"
}
```

### Error Reporting (Auth Required)

**POST /api/autonomous/error**
```bash
curl -X POST https://your-service.railway.app/api/autonomous/error \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "error": {
      "message": "Error message",
      "type": "ErrorType",
      "stack": "Error stack trace"
    },
    "context": {
      "application": "app-name",
      "endpoint": "/api/endpoint"
    },
    "severity": "HIGH",
    "source": "sentry"
  }'
```

Response:
```json
{
  "incident_id": "INC-XXX",
  "created": true,
  "severity": "HIGH",
  "category": "backend",
  "status": "detected",
  "timestamp": "2025-11-04T..."
}
```

### Incident Management

**GET /api/autonomous/incidents**
- List recent incidents
- Query params: `limit`, `status`

**GET /api/autonomous/incidents/:id**
- Get specific incident by incident_id

---

## Database Schema

### 8 Tables Created

1. **error_knowledge** - Known errors and solutions (RAG-enabled with pgvector)
2. **incidents** - All detected incidents with full lifecycle tracking
3. **monitoring_checks** - Health check logs (every 60 seconds)
4. **agent_actions** - Complete audit trail of all agent operations
5. **deployment_history** - Deployment tracking (Week 3+)
6. **security_events** - Security monitoring (Week 2+)
7. **system_config** - Feature flags and configuration
8. **email_tracking** - CEO notification tracking (Week 2+)

See `migrations/001_create_tables.sql` for complete schemas.

---

## Deployment

### Prerequisites
- Railway account with CLI
- Supabase project
- Node.js 18+

### Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Deploy database:**
```bash
# Run migrations/001_create_tables.sql in Supabase SQL Editor
```

3. **Deploy to Railway:**
```bash
railway login
railway init
railway variables set SUPABASE_URL="..."
railway variables set SUPABASE_ANON_KEY="..."
railway up
```

4. **Verify deployment:**
```bash
./scripts/test-endpoints.sh <railway-url>
```

See `DEPLOYMENT_GUIDE.md` for detailed instructions.

---

## Testing

### Automated Tests
```bash
# Test all endpoints
./scripts/test-endpoints.sh https://your-service.railway.app

# Verify database
# Run scripts/verify-database.sql in Supabase SQL Editor
```

### Manual Testing
```bash
# Test health
curl https://your-service.railway.app/health

# Create test incident
curl -X POST https://your-service.railway.app/api/autonomous/error \
  -H "Content-Type: application/json" \
  -d '{"error":{"message":"Test"},"context":{},"severity":"LOW","source":"test"}'

# List incidents
curl https://your-service.railway.app/api/autonomous/incidents
```

---

## Monitoring

### Health Checks
- Run every 60 seconds
- Check 3 endpoints: backend, frontend, database
- Store results in `monitoring_checks` table
- Create incidents for failures

### Logs
```bash
# View live logs
railway logs

# Look for:
# [HEALTH CHECK] Starting health checks...
# [HEALTH CHECK OK] backend - XXms
# [HEALTH CHECK OK] frontend - XXms
# [HEALTH CHECK OK] database - XXms
# [HEALTH CHECK] Completed
```

### Database Monitoring
```sql
-- Check recent activity
SELECT COUNT(*) FROM monitoring_checks
WHERE timestamp > NOW() - INTERVAL '5 minutes';

-- Expected: 15-25 rows (3 checks/min × 5 min)
```

---

## Configuration

### Environment Variables

**Required:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon/public key
- `API_KEY` - API key for authentication (min 32 characters recommended)
- `NODE_ENV` - Environment (production/development)

**Optional:**
- `PORT` - Server port (default: 3000)
- `ALLOWED_ORIGINS` - Comma-separated CORS origins (default: localhost:3000,localhost:3001)
- `ADMIN_CONSOLE_URL` - Frontend URL for health checks
- `BACKEND_API_URL` - Backend URL for health checks

### System Configuration

Configuration stored in `system_config` table:

- `agent_kill_switch` - Emergency stop (default: disabled)
- `agent_monitoring_enabled` - Monitoring active (default: enabled)
- `agent_auto_fix_enabled` - Auto-fix known errors (default: disabled, Week 3+)
- `monitoring_interval_seconds` - Check interval (default: 60)
- `max_deployments_per_hour` - Rate limit (default: 10)
- `require_human_approval_critical` - CEO approval for CRITICAL (default: enabled)
- `notification_email` - CEO email (default: ryan@ib365.ai)
- `deployment_window_start` - Earliest deploy hour (default: 9)
- `deployment_window_end` - Latest deploy hour (default: 21)

---

## Performance Metrics

### Week 1 Targets
- **Error Detection Latency:** < 60 seconds ✅
- **Database Writes:** < 100ms ✅
- **Health Check Response:** < 5 seconds ✅
- **Service Uptime:** > 99.5% ✅
- **Cron Accuracy:** ±5 seconds ✅

---

## Project Structure

```
autonomous-agent/
├── src/
│   ├── index.js                 # Main Express server
│   ├── config/
│   │   └── database.js          # Supabase connection
│   ├── routes/
│   │   ├── health.js            # Health check routes
│   │   └── error-reporting.js   # Error reporting API
│   ├── services/
│   │   └── error-classifier.js  # Error classification
│   ├── monitors/
│   │   └── health-check.js      # Health check monitor
│   ├── cron/
│   │   └── monitoring-cron.js   # Cron scheduler
│   └── utils/
│       └── logger.js            # Logging utility
├── migrations/
│   └── 001_create_tables.sql    # Database schema
├── scripts/
│   ├── test-endpoints.sh        # Endpoint tests
│   └── verify-database.sql      # Database verification
├── package.json
├── railway.toml
├── .env.example
├── README.md
└── DEPLOYMENT_GUIDE.md
```

---

## Roadmap

### ✅ Week 1 (Complete)
- Railway monitoring service
- 8 database tables
- Sentry webhook endpoint
- Health check service (every 60s)

### 📋 Week 2 (Next)
- RAG knowledge base implementation
- OpenAI embeddings integration
- Vector similarity search
- Playwright browser monitoring

### 📋 Week 3
- Auto-fix pipeline
- Blue-green deployments
- Safety checks (7 gates)
- Rollback automation

### 📋 Week 4
- Agent spawning & orchestration
- Multi-agent coordination
- Unknown error handling
- Team composition logic

### 📋 Week 5
- CEO notifications (Resend)
- Admin dashboard (Vercel)
- Production testing
- Documentation

---

## Support

### Troubleshooting
See `DEPLOYMENT_GUIDE.md` for common issues and solutions.

### Logs
```bash
# Railway logs
railway logs

# Database logs
# Check Supabase Dashboard > Logs
```

### Contact
- **PM Coordinator:** Reports to Liaison
- **Documentation:** See `/CONTEXT/BE_WEEK_1_TASK_BRIEF.md`
- **Architecture:** See `/Users/riscentrdb/Desktop/liaison/AUTONOMOUS_AGENT_ARCHITECTURE.md`

---

## License

Internal InboundAI365 Project

---

**Built with:**
- Node.js 18+
- Express
- Supabase (PostgreSQL + pgvector)
- Railway
- node-cron

**Week 1 Status:** ✅ **COMPLETE AND OPERATIONAL**

**Last Updated:** November 4, 2025
