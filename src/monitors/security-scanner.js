const { supabase } = require('../config/database');
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

    const { data: checks, error } = await supabase
      .from('monitoring_checks')
      .select('*')
      .gte('timestamp', oneMinuteAgo)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('[SECURITY] Rate limit check error:', error.message);
      return { check: 'rate_limit', anomaly: false };
    }

    if (checks && checks.length > SECURITY_RULES.rate_limit_threshold) {
      const eventId = `SEC-RATE-${Date.now()}`;

      // Create security event
      await supabase.from('security_events').insert({
        event_id: eventId,
        event_type: 'rate_limit_anomaly',
        severity: 'MEDIUM',
        status: 'detected',
        description: `Unusually high request rate detected: ${checks.length} requests in 1 minute`,
        confidence_score: 0.8,
        metadata: {
          requests_per_minute: checks.length,
          threshold: SECURITY_RULES.rate_limit_threshold
        }
      });

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

      const { data: recentChecks, error } = await supabase
        .from('monitoring_checks')
        .select('*')
        .gte('timestamp', fiveMinutesAgo)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('[SECURITY] Access pattern check error:', error.message);
        return { check: 'unusual_access', anomaly: false };
      }

      // If significant activity during off-hours (> 10 checks in 5 min)
      if (recentChecks && recentChecks.length > 10) {
        const eventId = `SEC-ACCESS-${Date.now()}`;

        await supabase.from('security_events').insert({
          event_id: eventId,
          event_type: 'unusual_access_pattern',
          severity: 'MEDIUM',
          status: 'detected',
          description: `Unusual access detected at ${currentHour}:00 (outside normal hours 6am-12am)`,
          confidence_score: 0.7,
          metadata: {
            hour: currentHour,
            requests: recentChecks.length,
            window: '5 minutes'
          }
        });

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

    const { data: authErrors, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('category', 'security')
      .gte('detected_at', oneHourAgo)
      .order('detected_at', { ascending: false });

    if (error) {
      console.error('[SECURITY] Failed login check error:', error.message);
      return { check: 'failed_logins', anomaly: false };
    }

    if (authErrors && authErrors.length >= SECURITY_RULES.failed_login_threshold) {
      const eventId = `SEC-AUTH-${Date.now()}`;

      // Create incident
      const { data: incident } = await supabase
        .from('incidents')
        .insert({
          incident_id: `INC-SEC-${Date.now()}`,
          title: 'Multiple authentication failures detected',
          error_message: `${authErrors.length} authentication errors in the last hour`,
          error_type: 'security_alert',
          severity: 'HIGH',
          category: 'security',
          application: 'admin-console-backend',
          status: 'detected',
          context: {
            failed_attempts: authErrors.length,
            threshold: SECURITY_RULES.failed_login_threshold,
            timeframe: '1 hour',
            incidents: authErrors.map(e => e.incident_id)
          }
        })
        .select()
        .single();

      // Create security event
      await supabase.from('security_events').insert({
        event_id: eventId,
        event_type: 'failed_login_attempts',
        severity: 'HIGH',
        status: 'detected',
        description: `${authErrors.length} failed authentication attempts in 1 hour`,
        confidence_score: 0.9,
        incident_created: incident?.id,
        metadata: {
          attempts: authErrors.length,
          threshold: SECURITY_RULES.failed_login_threshold
        }
      });

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

    const { data: checks, error } = await supabase
      .from('monitoring_checks')
      .select('*')
      .gte('timestamp', fiveMinutesAgo)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('[SECURITY] Rapid API check error:', error.message);
      return { check: 'rapid_api', anomaly: false };
    }

    if (checks && checks.length > SECURITY_RULES.rapid_api_threshold) {
      const eventId = `SEC-DDOS-${Date.now()}`;

      // Create security event
      await supabase.from('security_events').insert({
        event_id: eventId,
        event_type: 'rapid_api_calls',
        severity: 'CRITICAL',
        status: 'detected',
        description: `Potential DDoS attack: ${checks.length} API calls in 5 minutes`,
        confidence_score: 0.85,
        metadata: {
          calls: checks.length,
          threshold: SECURITY_RULES.rapid_api_threshold,
          timeframe: '5 minutes'
        }
      });

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
