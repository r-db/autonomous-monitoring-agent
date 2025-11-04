const axios = require('axios');
const { query } = require('../config/database');
const { logAgentAction } = require('../utils/logger');

// Health check configuration
const healthChecks = [
  {
    name: 'backend',
    url: process.env.BACKEND_API_URL + '/health',
    application: 'admin-console-backend',
    timeout: 5000,
    expected_status: 200
  },
  {
    name: 'frontend',
    url: process.env.ADMIN_CONSOLE_URL,
    application: 'admin-console-frontend',
    timeout: 5000,
    expected_status: 200
  },
  {
    name: 'database',
    url: process.env.BACKEND_API_URL + '/health/db',
    application: 'database',
    timeout: 5000,
    expected_status: 200
  }
];

/**
 * Run all configured health checks
 */
async function runHealthChecks() {
  console.log('[HEALTH CHECK] Starting health checks...');

  for (const check of healthChecks) {
    const startTime = Date.now();
    const checkId = `CHK-${Date.now()}-${check.name}`;

    try {
      const response = await axios.get(check.url, {
        timeout: check.timeout,
        validateStatus: () => true, // Don't throw on non-200
        headers: {
          'User-Agent': 'Autonomous-Monitoring-Agent/1.0'
        }
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = response.status === check.expected_status;

      // Log check to database
      await query(
        `INSERT INTO monitoring_checks (check_id, check_type, target, application, status, http_status, response_time_ms, errors_detected)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [checkId, 'health', check.url, check.application, isHealthy ? 'healthy' : 'error', response.status, responseTime, isHealthy ? 0 : 1]
      );

      if (!isHealthy) {
        // Create incident for failed health check
        const { rows } = await query(
          `INSERT INTO incidents (incident_id, title, error_message, error_type, severity, category, application, status, context)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            `INC-HEALTH-${Date.now()}`,
            `Health check failed: ${check.name}`,
            `${check.name} health check failed. Status: ${response.status}, Expected: ${check.expected_status}`,
            'health_check_failure',
            'CRITICAL',
            'infrastructure',
            check.application,
            'detected',
            JSON.stringify({
              check_name: check.name,
              url: check.url,
              http_status: response.status,
              response_time_ms: responseTime
            })
          ]
        );
        const incident = rows[0];

        console.error(`[HEALTH CHECK FAILED] ${check.name} - Status: ${response.status}`);

        // Log action
        await logAgentAction({
          agent_id: 'health-monitor',
          agent_type: 'monitoring',
          action_type: 'health_check_failure',
          action_description: `Health check failed for ${check.name}`,
          action_success: false,
          incident_id: incident?.id,
          action_details: {
            check_name: check.name,
            http_status: response.status,
            response_time_ms: responseTime
          }
        });
      } else {
        console.log(`[HEALTH CHECK OK] ${check.name} - ${responseTime}ms`);
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Log failed check
      await query(
        `INSERT INTO monitoring_checks (check_id, check_type, target, application, status, response_time_ms, errors_detected, error_details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          checkId,
          'health',
          check.url,
          check.application,
          'error',
          responseTime,
          1,
          JSON.stringify({
            error: error.message,
            code: error.code
          })
        ]
      );

      // Create incident for exception
      const { rows } = await query(
        `INSERT INTO incidents (incident_id, title, error_message, error_type, severity, category, application, status, context)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          `INC-HEALTH-${Date.now()}`,
          `Health check failed: ${check.name}`,
          `${check.name} health check failed with error: ${error.message}`,
          'health_check_failure',
          'CRITICAL',
          'infrastructure',
          check.application,
          'detected',
          JSON.stringify({
            check_name: check.name,
            url: check.url,
            error: error.message,
            error_code: error.code
          })
        ]
      );
      const incident = rows[0];

      console.error(`[HEALTH CHECK ERROR] ${check.name} - ${error.message}`);

      // Log action
      await logAgentAction({
        agent_id: 'health-monitor',
        agent_type: 'monitoring',
        action_type: 'health_check_failure',
        action_description: `Health check error for ${check.name}: ${error.message}`,
        action_success: false,
        incident_id: incident?.id,
        action_details: {
          check_name: check.name,
          error: error.message,
          error_code: error.code
        }
      });
    }
  }

  console.log('[HEALTH CHECK] Completed');
}

module.exports = { runHealthChecks };
