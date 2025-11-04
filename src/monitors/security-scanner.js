const { query } = require('../config/database');
const { logAgentAction } = require('../utils/logger');

// Security monitoring rules
const SECURITY_RULES = {
  rate_limit_threshold: 100,    // requests per minute
  failed_login_threshold: 5,     // failed logins per hour
  unusual_access_window: {       // Off-hours: 12am-6am
    start: 0,
    end: 6
  },
  rapid_api_threshold: 100       // API calls in 5 minutes
};

/**
 * Run all security checks
 */
async function runSecurityChecks() {
  console.log('[SECURITY MONITOR] Running security checks...');

  const results = {
    timestamp: new Date().toISOString(),
    checks: [],
    anomaliesDetected: 0
  };

  // Run all security checks
  const checks = await Promise.allSettled([
    checkRateLimitAnomalies(),
    checkUnusualAccessPatterns(),
    checkFailedLoginAttempts(),
    checkRapidAPICalls()
  ]);

  // Process results
  checks.forEach((result, index) => {
    const checkName = ['rate_limit', 'unusual_access', 'failed_logins', 'rapid_api'][index];

    if (result.status === 'fulfilled' && result.value) {
      results.checks.push(result.value);
      if (result.value.anomaly) {
        results.anomaliesDetected++;
      }
    } else if (result.status === 'rejected') {
      console.error(`[SECURITY] Check ${checkName} failed:`, result.reason);
      results.checks.push({
        check: checkName,
        anomaly: false,
        error: result.reason.message
      });
    }
  });

  console.log(`[SECURITY MONITOR] Completed. Anomalies: ${results.anomaliesDetected}`);

  // Log security scan
  await logAgentAction({
    agent_id: 'security-scanner',
    agent_type: 'monitoring',
    action_type: 'security_scan_completed',
    action_description: `Security scan completed. Anomalies detected: ${results.anomaliesDetected}`,
    action_success: true,
    action_details: {
      anomalies: results.anomaliesDetected,
      checks_run: results.checks.length
    }
  });

  return results;
}

/**
 * Check for rate limit anomalies
 */
async function checkRateLimitAnomalies() {
  try {
    // Check monitoring_checks frequency in last minute
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

    const { rows: checks, error } = await query(
      `SELECT * FROM monitoring_checks WHERE timestamp >= $1 ORDER BY timestamp DESC`,
      [oneMinuteAgo]
    );

    if (error) {
      console.error('[SECURITY] Rate limit check error:', error.message);
      return { check: 'rate_limit', anomaly: false };
    }

    if (checks && checks.length > SECURITY_RULES.rate_limit_threshold) {
      const eventId = `SEC-RATE-${Date.now()}`;

      // Create security event
      await query(
        `INSERT INTO security_events (event_id, event_type, severity, status, description, confidence_score, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          eventId,
          'rate_limit_anomaly',
          'MEDIUM',
          'detected',
          `Unusually high request rate detected: ${checks.length} requests in 1 minute`,
          0.8,
          JSON.stringify({
            requests_per_minute: checks.length,
            threshold: SECURITY_RULES.rate_limit_threshold
          })
        ]
      );

      console.warn(`[SECURITY] Rate limit anomaly: ${checks.length} req/min (threshold: ${SECURITY_RULES.rate_limit_threshold})`);

      return {
        check: 'rate_limit',
        anomaly: true,
        severity: 'MEDIUM',
        message: `${checks.length} requests in 1 minute exceeds threshold`,
        metadata: {
          requests: checks.length,
          threshold: SECURITY_RULES.rate_limit_threshold
        }
      };
    }

    return { check: 'rate_limit', anomaly: false };

  } catch (error) {
    console.error('[SECURITY] Rate limit check error:', error.message);
    return { check: 'rate_limit', anomaly: false, error: error.message };
  }
}

/**
 * Check for unusual access patterns (off-hours activity)
 */
async function checkUnusualAccessPatterns() {
  try {
    const currentHour = new Date().getHours();

    // Check if we're in unusual access window (12am-6am)
    if (currentHour >= SECURITY_RULES.unusual_access_window.start &&
        currentHour < SECURITY_RULES.unusual_access_window.end) {

      // Check for activity in last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();

      const { rows: recentChecks, error } = await query(
        `SELECT * FROM monitoring_checks WHERE timestamp >= $1 ORDER BY timestamp DESC`,
        [fiveMinutesAgo]
      );

      if (error) {
        console.error('[SECURITY] Access pattern check error:', error.message);
        return { check: 'unusual_access', anomaly: false };
      }

      // If significant activity during off-hours (> 10 checks in 5 min)
      if (recentChecks && recentChecks.length > 10) {
        const eventId = `SEC-ACCESS-${Date.now()}`;

        await query(
          `INSERT INTO security_events (event_id, event_type, severity, status, description, confidence_score, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            eventId,
            'unusual_access_pattern',
            'MEDIUM',
            'detected',
            `Unusual access detected at ${currentHour}:00 (outside normal hours 6am-12am)`,
            0.7,
            JSON.stringify({
              hour: currentHour,
              requests: recentChecks.length,
              window: '5 minutes'
            })
          ]
        );

        console.warn(`[SECURITY] Unusual access at ${currentHour}:00 - ${recentChecks.length} requests`);

        return {
          check: 'unusual_access',
          anomaly: true,
          severity: 'MEDIUM',
          message: `Activity detected during off-hours (${currentHour}:00)`,
          metadata: {
            hour: currentHour,
            requests: recentChecks.length
          }
        };
      }
    }

    return { check: 'unusual_access', anomaly: false };

  } catch (error) {
    console.error('[SECURITY] Access pattern check error:', error.message);
    return { check: 'unusual_access', anomaly: false, error: error.message };
  }
}

/**
 * Check for failed login attempts
 */
async function checkFailedLoginAttempts() {
  try {
    // Check for auth-related errors in incidents (last hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const { rows: authErrors, error } = await query(
      `SELECT * FROM incidents WHERE category = $1 AND detected_at >= $2 ORDER BY detected_at DESC`,
      ['security', oneHourAgo]
    );

    if (error) {
      console.error('[SECURITY] Failed login check error:', error.message);
      return { check: 'failed_logins', anomaly: false };
    }

    if (authErrors && authErrors.length >= SECURITY_RULES.failed_login_threshold) {
      const eventId = `SEC-AUTH-${Date.now()}`;

      // Create incident
      const { rows: incidentRows } = await query(
        `INSERT INTO incidents (incident_id, title, error_message, error_type, severity, category, application, status, context)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          `INC-SEC-${Date.now()}`,
          'Multiple authentication failures detected',
          `${authErrors.length} authentication errors in the last hour`,
          'security_alert',
          'HIGH',
          'security',
          'admin-console-backend',
          'detected',
          JSON.stringify({
            failed_attempts: authErrors.length,
            threshold: SECURITY_RULES.failed_login_threshold,
            timeframe: '1 hour',
            incidents: authErrors.map(e => e.incident_id)
          })
        ]
      );
      const incident = incidentRows[0];

      // Create security event
      await query(
        `INSERT INTO security_events (event_id, event_type, severity, status, description, confidence_score, incident_created, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          eventId,
          'failed_login_attempts',
          'HIGH',
          'detected',
          `${authErrors.length} failed authentication attempts in 1 hour`,
          0.9,
          incident?.id,
          JSON.stringify({
            attempts: authErrors.length,
            threshold: SECURITY_RULES.failed_login_threshold
          })
        ]
      );

      // Log action
      await logAgentAction({
        agent_id: 'security-scanner',
        agent_type: 'monitoring',
        action_type: 'security_alert',
        action_description: `Multiple authentication failures detected: ${authErrors.length} attempts`,
        action_success: true,
        incident_id: incident?.id,
        action_details: {
          failed_attempts: authErrors.length
        }
      });

      console.warn(`[SECURITY] ${authErrors.length} auth failures detected (threshold: ${SECURITY_RULES.failed_login_threshold})`);

      return {
        check: 'failed_logins',
        anomaly: true,
        severity: 'HIGH',
        message: `${authErrors.length} authentication failures in 1 hour`,
        metadata: {
          attempts: authErrors.length,
          threshold: SECURITY_RULES.failed_login_threshold
        }
      };
    }

    return { check: 'failed_logins', anomaly: false };

  } catch (error) {
    console.error('[SECURITY] Failed login check error:', error.message);
    return { check: 'failed_logins', anomaly: false, error: error.message };
  }
}

/**
 * Check for rapid API calls (potential DDoS)
 */
async function checkRapidAPICalls() {
  try {
    // Check for > 100 requests in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();

    const { rows: checks, error } = await query(
      `SELECT * FROM monitoring_checks WHERE timestamp >= $1 ORDER BY timestamp DESC`,
      [fiveMinutesAgo]
    );

    if (error) {
      console.error('[SECURITY] Rapid API check error:', error.message);
      return { check: 'rapid_api', anomaly: false };
    }

    if (checks && checks.length > SECURITY_RULES.rapid_api_threshold) {
      const eventId = `SEC-DDOS-${Date.now()}`;

      // Create security event
      await query(
        `INSERT INTO security_events (event_id, event_type, severity, status, description, confidence_score, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          eventId,
          'rapid_api_calls',
          'CRITICAL',
          'detected',
          `Potential DDoS attack: ${checks.length} API calls in 5 minutes`,
          0.85,
          JSON.stringify({
            calls: checks.length,
            threshold: SECURITY_RULES.rapid_api_threshold,
            timeframe: '5 minutes'
          })
        ]
      );

      console.warn(`[SECURITY] Rapid API calls: ${checks.length} in 5 min (threshold: ${SECURITY_RULES.rapid_api_threshold})`);

      return {
        check: 'rapid_api',
        anomaly: true,
        severity: 'CRITICAL',
        message: `Potential DDoS: ${checks.length} calls in 5 minutes`,
        metadata: {
          calls: checks.length,
          threshold: SECURITY_RULES.rapid_api_threshold
        }
      };
    }

    return { check: 'rapid_api', anomaly: false };

  } catch (error) {
    console.error('[SECURITY] Rapid API check error:', error.message);
    return { check: 'rapid_api', anomaly: false, error: error.message };
  }
}

module.exports = { runSecurityChecks };
