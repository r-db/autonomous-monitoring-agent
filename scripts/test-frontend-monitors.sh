#!/bin/bash

# Test Frontend Monitoring Features
# This script tests the Playwright monitor, security scanner, and manual trigger endpoints

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
SERVICE_URL="${1:-http://localhost:3000}"

echo "========================================="
echo "Frontend Monitoring Tests"
echo "========================================="
echo "Service URL: $SERVICE_URL"
echo ""

# Test 1: Check service is running
echo -e "${YELLOW}Test 1: Service Health Check${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/health")
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Service is healthy (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Service not responding (HTTP $HTTP_CODE)${NC}"
    exit 1
fi
echo ""

# Test 2: Check system status endpoint
echo -e "${YELLOW}Test 2: System Status Endpoint${NC}"
RESPONSE=$(curl -s "$SERVICE_URL/api/autonomous/status")
echo "$RESPONSE" | jq '.' > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Status endpoint working${NC}"
    echo "Response:"
    echo "$RESPONSE" | jq '.'
else
    echo -e "${RED}✗ Status endpoint failed${NC}"
fi
echo ""

# Test 3: Manual trigger - Health checks
echo -e "${YELLOW}Test 3: Trigger Health Checks${NC}"
RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/autonomous/trigger/health" \
    -H "Content-Type: application/json")
echo "$RESPONSE" | jq '.' > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Health check trigger successful${NC}"
    echo "Response:"
    echo "$RESPONSE" | jq '.success, .message'
else
    echo -e "${RED}✗ Health check trigger failed${NC}"
fi
echo ""

# Test 4: Manual trigger - Browser monitoring
echo -e "${YELLOW}Test 4: Trigger Browser Monitoring${NC}"
RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/autonomous/trigger/browser" \
    -H "Content-Type: application/json")
echo "$RESPONSE" | jq '.' > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Browser monitoring trigger successful${NC}"
    echo "Response:"
    echo "$RESPONSE" | jq '.success, .message'
    echo ""
    echo "Note: Browser monitoring runs asynchronously. Check logs for completion."
else
    echo -e "${RED}✗ Browser monitoring trigger failed${NC}"
fi
echo ""

# Test 5: Manual trigger - Security checks
echo -e "${YELLOW}Test 5: Trigger Security Checks${NC}"
RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/autonomous/trigger/security" \
    -H "Content-Type: application/json")
echo "$RESPONSE" | jq '.' > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Security check trigger successful${NC}"
    echo "Response:"
    echo "$RESPONSE" | jq '.success, .message'
else
    echo -e "${RED}✗ Security check trigger failed${NC}"
fi
echo ""

# Test 6: Create test error
echo -e "${YELLOW}Test 6: Create Test Error${NC}"
RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/autonomous/trigger-test-error" \
    -H "Content-Type: application/json" \
    -d '{
        "error_type": "test_error",
        "severity": "MEDIUM",
        "message": "Test error from frontend monitoring test script"
    }')
echo "$RESPONSE" | jq '.' > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Test error created${NC}"
    echo "Response:"
    echo "$RESPONSE" | jq '.success, .incident_id, .incident.title'
else
    echo -e "${RED}✗ Test error creation failed${NC}"
fi
echo ""

# Test 7: Trigger all monitoring
echo -e "${YELLOW}Test 7: Trigger All Monitoring (Comprehensive)${NC}"
RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/autonomous/trigger" \
    -H "Content-Type: application/json")
echo "$RESPONSE" | jq '.' > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ All monitoring triggered${NC}"
    echo "Response:"
    echo "$RESPONSE" | jq '.success, .message, .results.checks | keys'
else
    echo -e "${RED}✗ All monitoring trigger failed${NC}"
fi
echo ""

# Test 8: Check root endpoint
echo -e "${YELLOW}Test 8: Root Endpoint (Available Endpoints)${NC}"
RESPONSE=$(curl -s "$SERVICE_URL/")
echo "$RESPONSE" | jq '.' > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Root endpoint working${NC}"
    echo "Available Endpoints:"
    echo "$RESPONSE" | jq '.endpoints'
else
    echo -e "${RED}✗ Root endpoint failed${NC}"
fi
echo ""

echo "========================================="
echo "Frontend Monitoring Tests Complete"
echo "========================================="
echo ""
echo "Next Steps:"
echo "1. Check service logs: railway logs (if deployed)"
echo "2. Verify database entries in Supabase"
echo "3. Check screenshots directory: ls -la screenshots/"
echo "4. Monitor browser checks (run every 5 minutes)"
echo "5. Monitor security checks (run every 10 minutes)"
echo ""
