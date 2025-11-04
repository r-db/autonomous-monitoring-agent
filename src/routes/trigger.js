const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { monitorBrowserErrors } = require('../monitors/playwright-monitor');
const { runHealthChecks } = require('../monitors/health-check');
const { runSecurityChecks } = require('../monitors/security-scanner');
const { logAgentAction } = require('../utils/logger');
const { triggerLimiter } = require('../middleware/rate-limit');

/**
 * POST /api/autonomous/trigger
 * Manually trigger all monitoring checks
 */
router.post('/api/autonomous/trigger', triggerLimiter, async (req, res) => {
  console.log('[MANUAL TRIGGER] Triggering all monitoring checks...');

  try {
    const results = {
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Run all monitors in parallel
    const [healthResult, browserResult, securityResult] = await Promise.allSettled([
      runHealthChecks(),
      monitorBrowserErrors(),
      runSecurityChecks()
    ]);

    // Process health check result
    if (healthResult.status === 'fulfilled') {
      results.checks.health = {
        success: true,
        result: healthResult.value
      };
    } else {
      results.checks.health = {
        success: false,
        error: healthResult.reason?.message || 'Unknown error'
      };
    }

    // Process browser check result
    if (browserResult.status === 'fulfilled') {
      results.checks.browser = {
        success: true,
        result: 'Browser monitoring completed'
      };
    } else {
      results.checks.browser = {
        success: false,
        error: browserResult.reason?.message || 'Unknown error'
      };
    }

    // Process security check result
    if (securityResult.status === 'fulfilled') {
      results.checks.security = {
        success: true,
        result: securityResult.value
      };
    } else {
      results.checks.security = {
        success: false,
        error: securityResult.reason?.message || 'Unknown error'
      };
    }

    // Log action
    await logAgentAction({
      agent_id: 'manual-trigger',
      agent_type: 'monitoring',
      action_type: 'manual_trigger_all',
      action_description: 'Manual trigger for all monitoring checks',
      action_success: true,
      action_details: results
    });

    console.log('[MANUAL TRIGGER] All checks completed');

    res.status(200).json({
      success: true,
      message: 'All monitoring checks triggered successfully',
      results
    });

  } catch (error) {
    console.error('[MANUAL TRIGGER] Error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to trigger monitoring',
      message: error.message
    });
  }
});

/**
 * POST /api/autonomous/trigger/browser
 * Manually trigger browser monitoring only
 */
router.post('/api/autonomous/trigger/browser', async (req, res) => {
  console.log('[MANUAL TRIGGER] Triggering browser monitoring...');

  try {
    // Trigger async (respond immediately)
    res.json({
      success: true,
      message: 'Browser monitoring triggered'
    });

    // Run browser monitoring
    await monitorBrowserErrors();

    console.log('[MANUAL TRIGGER] Browser monitoring completed');

  } catch (error) {
    console.error('[MANUAL TRIGGER] Browser monitoring error:', error);
  }
});

/**
 * POST /api/autonomous/trigger/security
 * Manually trigger security checks only
 */
router.post('/api/autonomous/trigger/security', async (req, res) => {
  console.log('[MANUAL TRIGGER] Triggering security checks...');

  try {
    // Trigger async (respond immediately)
    res.json({
      success: true,
      message: 'Security checks triggered'
    });

    // Run security checks
    await runSecurityChecks();

    console.log('[MANUAL TRIGGER] Security checks completed');

  } catch (error) {
    console.error('[MANUAL TRIGGER] Security checks error:', error);
  }
});

/**
 * POST /api/autonomous/trigger/health
 * Manually trigger health checks only
 */
router.post('/api/autonomous/trigger/health', async (req, res) => {
  console.log('[MANUAL TRIGGER] Triggering health checks...');

  try {
    const result = await runHealthChecks();

    res.json({
      success: true,
      message: 'Health checks completed',
      result
    });

  } catch (error) {
    console.error('[MANUAL TRIGGER] Health checks error:', error);

    res.status(500).json({
      success: false,
      error: 'Health checks failed',
      message: error.message
    });
  }
});

/**
 * POST /api/autonomous/trigger-test-error
 * Create a test error for testing monitoring system
 */
router.post('/api/autonomous/trigger-test-error', async (req, res) => {
  try {
    const { error_type, severity, message } = req.body;

    const incidentId = `INC-TEST-${Date.now()}`;

    const { rows, error: dbError } = await query(
      `INSERT INTO incidents (incident_id, title, error_message, error_type, severity, category, application, status, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        incidentId,
        `Test error: ${error_type || 'manual'}`,
        message || 'Manual test error for monitoring system',
        error_type || 'test_error',
        severity || 'MEDIUM',
        'test',
        'autonomous-monitoring-agent',
        'detected',
        JSON.stringify({
          test: true,
          triggered_manually: true,
          timestamp: new Date().toISOString()
        })
      ]
    );
    const incident = rows[0];

    if (dbError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create test error',
        message: dbError.message
      });
    }

    await logAgentAction({
      agent_id: 'manual-trigger',
      agent_type: 'monitoring',
      action_type: 'test_error_created',
      action_description: 'Manual test error created',
      action_success: true,
      incident_id: incident.id
    });

    console.log(`[MANUAL TRIGGER] Test error created: ${incidentId}`);

    res.json({
      success: true,
      incident_id: incidentId,
      incident: incident
    });

  } catch (error) {
    console.error('[MANUAL TRIGGER] Error creating test incident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test error',
      message: error.message
    });
  }
});

/**
 * GET /api/autonomous/status
 * Get system status and recent activity
 */
router.get('/api/autonomous/status', async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    // Get recent monitoring activity
    const { rows: recentChecks } = await query(
      'SELECT * FROM monitoring_checks WHERE timestamp >= $1 ORDER BY timestamp DESC LIMIT 100',
      [oneHourAgo]
    );

    const { rows: recentIncidents } = await query(
      'SELECT * FROM incidents WHERE detected_at >= $1 ORDER BY detected_at DESC LIMIT 20',
      [oneHourAgo]
    );

    const { rows: config } = await query('SELECT * FROM system_config', []);

    const configMap = {};
    config?.forEach(item => {
      configMap[item.key] = item.value;
    });

    // Count checks by type
    const checksByType = {
      health: recentChecks?.filter(c => c.check_type === 'health').length || 0,
      browser: recentChecks?.filter(c => c.check_type === 'browser').length || 0,
      security: 0 // Security checks don't create monitoring_checks entries
    };

    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      monitoring_enabled: configMap.agent_monitoring_enabled?.enabled !== false,
      auto_fix_enabled: configMap.agent_auto_fix_enabled?.enabled || false,
      kill_switch: configMap.agent_kill_switch?.enabled || false,
      last_hour_stats: {
        total_checks: recentChecks?.length || 0,
        checks_by_type: checksByType,
        total_incidents: recentIncidents?.length || 0,
        errors: recentChecks?.filter(c => c.status === 'error').length || 0,
        warnings: recentChecks?.filter(c => c.status === 'warning').length || 0,
        healthy: recentChecks?.filter(c => c.status === 'healthy').length || 0
      },
      recent_incidents: recentIncidents?.slice(0, 5).map(i => ({
        incident_id: i.incident_id,
        severity: i.severity,
        category: i.category,
        application: i.application,
        error_message: i.error_message.substring(0, 100) + (i.error_message.length > 100 ? '...' : ''),
        detected_at: i.detected_at
      })) || []
    });

  } catch (error) {
    console.error('[STATUS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status',
      message: error.message
    });
  }
});

module.exports = router;
