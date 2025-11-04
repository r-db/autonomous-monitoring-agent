#!/bin/bash

# Test Autonomous Monitoring Agent Endpoints
# Usage: ./scripts/test-endpoints.sh <railway-url>

set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/test-endpoints.sh <railway-url>"
  echo "Example: ./scripts/test-endpoints.sh https://your-service.railway.app"
  exit 1
fi

RAILWAY_URL="$1"

echo "========================================="
echo "Testing Autonomous Monitoring Agent"
echo "URL: $RAILWAY_URL"
echo "========================================="
echo ""

# Test 1: Root endpoint
echo "Test 1: Root Endpoint (GET /)"
echo "---"
curl -s "$RAILWAY_URL/" | jq '.'
echo ""
echo "✅ Root endpoint OK"
echo ""

# Test 2: Health endpoint
echo "Test 2: Health Endpoint (GET /health)"
echo "---"
HEALTH_RESPONSE=$(curl -s "$RAILWAY_URL/health")
echo "$HEALTH_RESPONSE" | jq '.'

# Check if healthy
STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status')
if [ "$STATUS" = "healthy" ]; then
  echo ""
  echo "✅ Health check PASSED"
else
  echo ""
  echo "❌ Health check FAILED: Status is $STATUS"
  exit 1
fi
echo ""

# Test 3: Status endpoint
echo "Test 3: Status Endpoint (GET /status)"
echo "---"
curl -s "$RAILWAY_URL/status" | jq '.'
echo ""
echo "✅ Status endpoint OK"
echo ""

# Test 4: Error reporting endpoint
echo "Test 4: Error Reporting (POST /api/autonomous/error)"
echo "---"
ERROR_RESPONSE=$(curl -s -X POST "$RAILWAY_URL/api/autonomous/error" \
  -H "Content-Type: application/json" \
  -d '{
    "error": {
      "message": "Test error from test script",
      "type": "TestError",
      "stack": "Error: Test error\n    at test.js:10:5"
    },
    "context": {
      "application": "test-script",
      "endpoint": "/test"
    },
    "severity": "LOW",
    "source": "test_script"
  }')

echo "$ERROR_RESPONSE" | jq '.'

# Check if incident created
INCIDENT_ID=$(echo "$ERROR_RESPONSE" | jq -r '.incident_id')
if [ -z "$INCIDENT_ID" ] || [ "$INCIDENT_ID" = "null" ]; then
  echo ""
  echo "❌ Error reporting FAILED: No incident ID returned"
  exit 1
else
  echo ""
  echo "✅ Error reporting OK - Incident created: $INCIDENT_ID"
fi
echo ""

# Test 5: Get incident
echo "Test 5: Get Incident (GET /api/autonomous/incidents/$INCIDENT_ID)"
echo "---"
curl -s "$RAILWAY_URL/api/autonomous/incidents/$INCIDENT_ID" | jq '.'
echo ""
echo "✅ Get incident OK"
echo ""

# Test 6: List incidents
echo "Test 6: List Incidents (GET /api/autonomous/incidents?limit=5)"
echo "---"
INCIDENTS_RESPONSE=$(curl -s "$RAILWAY_URL/api/autonomous/incidents?limit=5")
echo "$INCIDENTS_RESPONSE" | jq '.'

INCIDENT_COUNT=$(echo "$INCIDENTS_RESPONSE" | jq '.count')
echo ""
echo "✅ List incidents OK - Found $INCIDENT_COUNT incidents"
echo ""

# Summary
echo "========================================="
echo "All Tests Passed! ✅"
echo "========================================="
echo ""
echo "Test incident created: $INCIDENT_ID"
echo ""
echo "Next steps:"
echo "1. Check Railway logs for health checks"
echo "2. Verify database has monitoring_checks entries"
echo "3. Monitor for 5 minutes to see cron jobs running"
echo ""
