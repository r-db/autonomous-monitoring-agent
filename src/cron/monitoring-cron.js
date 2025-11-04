const cron = require('node-cron');
const { runHealthChecks } = require('../monitors/health-check');
const { monitorBrowserErrors } = require('../monitors/playwright-monitor');
const { runSecurityChecks } = require('../monitors/security-scanner');
const { logAgentAction } = require('../utils/logger');

/**
 * Start all monitoring cron jobs
 */
function startMonitoring() {
  console.log('[CRON] Starting monitoring cron jobs...');

  // Run health checks every minute (at the start of each minute)
  const healthCheckJob = cron.schedule('* * * * *', async () => {
    try {
      await runHealthChecks();
    } catch (error) {
      console.error('[CRON ERROR] Health check failed:', error);

      // Log failure
      await logAgentAction({
        agent_id: 'monitoring-cron',
        agent_type: 'monitoring',
        action_type: 'cron_error',
        action_description: `Cron job failed: ${error.message}`,
        action_success: false,
        action_details: {
          job: 'health_checks',
          error: error.message
        }
      });
    }
  });

  console.log('[CRON] Health check cron scheduled (every minute)');

  // Run browser checks every 5 minutes (offset by 30 seconds from health checks)
  const browserCheckJob = cron.schedule('*/5 * * * *', async () => {
    try {
      await monitorBrowserErrors();
    } catch (error) {
      console.error('[CRON ERROR] Browser monitoring failed:', error);

      // Log failure
      await logAgentAction({
        agent_id: 'monitoring-cron',
        agent_type: 'monitoring',
        action_type: 'cron_error',
        action_description: `Browser monitoring cron failed: ${error.message}`,
        action_success: false,
        action_details: {
          job: 'browser_monitoring',
          error: error.message
        }
      });
    }
  });

  console.log('[CRON] Browser monitoring cron scheduled (every 5 minutes)');

  // Run security checks every 10 minutes
  const securityCheckJob = cron.schedule('*/10 * * * *', async () => {
    try {
      await runSecurityChecks();
    } catch (error) {
      console.error('[CRON ERROR] Security monitoring failed:', error);

      // Log failure
      await logAgentAction({
        agent_id: 'monitoring-cron',
        agent_type: 'monitoring',
        action_type: 'cron_error',
        action_description: `Security monitoring cron failed: ${error.message}`,
        action_success: false,
        action_details: {
          job: 'security_monitoring',
          error: error.message
        }
      });
    }
  });

  console.log('[CRON] Security monitoring cron scheduled (every 10 minutes)');

  // Run initial health check after 5 seconds
  setTimeout(async () => {
    console.log('[CRON] Running initial health check...');
    try {
      await runHealthChecks();
    } catch (error) {
      console.error('[CRON ERROR] Initial health check failed:', error);
    }
  }, 5000);

  // Run initial browser check after 15 seconds
  setTimeout(async () => {
    console.log('[CRON] Running initial browser check...');
    try {
      await monitorBrowserErrors();
    } catch (error) {
      console.error('[CRON ERROR] Initial browser check failed:', error);
    }
  }, 15000);

  // Run initial security check after 20 seconds
  setTimeout(async () => {
    console.log('[CRON] Running initial security check...');
    try {
      await runSecurityChecks();
    } catch (error) {
      console.error('[CRON ERROR] Initial security check failed:', error);
    }
  }, 20000);

  // Log monitoring start
  logAgentAction({
    agent_id: 'monitoring-cron',
    agent_type: 'monitoring',
    action_type: 'monitoring_started',
    action_description: 'Monitoring cron jobs started successfully',
    action_success: true,
    action_details: {
      jobs: ['health_checks', 'browser_monitoring', 'security_monitoring'],
      intervals: ['60 seconds', '300 seconds', '600 seconds']
    }
  });

  return {
    healthCheckJob,
    browserCheckJob,
    securityCheckJob
  };
}

/**
 * Stop all monitoring cron jobs
 */
function stopMonitoring(jobs) {
  console.log('[CRON] Stopping monitoring cron jobs...');

  if (jobs) {
    if (jobs.healthCheckJob) {
      jobs.healthCheckJob.stop();
    }
    if (jobs.browserCheckJob) {
      jobs.browserCheckJob.stop();
    }
    if (jobs.securityCheckJob) {
      jobs.securityCheckJob.stop();
    }
  }

  logAgentAction({
    agent_id: 'monitoring-cron',
    agent_type: 'monitoring',
    action_type: 'monitoring_stopped',
    action_description: 'Monitoring cron jobs stopped',
    action_success: true
  });

  console.log('[CRON] Monitoring cron jobs stopped');
}

module.exports = { startMonitoring, stopMonitoring };
