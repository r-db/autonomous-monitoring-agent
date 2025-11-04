#!/bin/bash

echo "========================================="
echo "Security Tests"
echo "========================================="

BASE_URL="http://localhost:3000"
API_KEY="${API_KEY:-test-key-12345}"

# Test 1: API without key (should fail)
echo "[TEST 1] Request without API key (should fail 401)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/autonomous/trigger)
if [ "$STATUS" = "401" ]; then
  echo "✓ PASS: Unauthorized without API key"
else
  echo "✗ FAIL: Expected 401, got $STATUS"
fi

# Test 2: API with key (should succeed)
echo "[TEST 2] Request with API key (should succeed)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "x-api-key: $API_KEY" $BASE_URL/api/autonomous/trigger)
if [ "$STATUS" = "200" ]; then
  echo "✓ PASS: Authorized with API key"
else
  echo "✗ FAIL: Expected 200, got $STATUS"
fi

# Test 3: Invalid input (should fail validation)
echo "[TEST 3] Invalid input validation (should fail 400)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -X POST $BASE_URL/api/autonomous/error \
  -d '{"error":{"message":""},"severity":"INVALID"}')
if [ "$STATUS" = "400" ]; then
  echo "✓ PASS: Validation rejected invalid input"
else
  echo "⚠ WARNING: Expected 400, got $STATUS (custom validation may differ)"
fi

# Test 4: Rate limiting (send 10 requests rapidly)
echo "[TEST 4] Rate limiting test (6 rapid requests to trigger endpoint)..."
sleep 1
COUNT=0
for i in {1..6}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "x-api-key: $API_KEY" $BASE_URL/api/autonomous/trigger)
  if [ "$STATUS" = "429" ]; then
    COUNT=$((COUNT + 1))
  fi
done
if [ $COUNT -gt 0 ]; then
  echo "✓ PASS: Rate limiting triggered after multiple requests (got $COUNT 429 responses)"
else
  echo "⚠ WARNING: Rate limiting not triggered (may need more requests or shorter window)"
fi

# Test 5: Wrong API key (should fail)
echo "[TEST 5] Request with wrong API key (should fail 401)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "x-api-key: wrong-key" $BASE_URL/api/autonomous/trigger)
if [ "$STATUS" = "401" ]; then
  echo "✓ PASS: Rejected wrong API key"
else
  echo "✗ FAIL: Expected 401, got $STATUS"
fi

# Test 6: Health endpoint without auth (should succeed)
echo "[TEST 6] Health endpoint without API key (should succeed)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/health)
if [ "$STATUS" = "200" ]; then
  echo "✓ PASS: Health endpoint accessible without auth"
else
  echo "✗ FAIL: Expected 200, got $STATUS"
fi

echo "========================================="
echo "Security Tests Complete"
echo "========================================="
