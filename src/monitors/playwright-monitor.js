const { chromium } = require('playwright');
const { query } = require('../config/database');
const { logAgentAction } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { PAGES_TO_MONITOR } = require('./pages-config');

/**
 * Monitor browser console for errors using Playwright
 */
async function monitorBrowserErrors() {
  console.log('[PLAYWRIGHT MONITOR] Starting browser checks...');

  let browser;
  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Check each page
    for (const pageConfig of PAGES_TO_MONITOR) {
      await checkPage(browser, pageConfig);
    }

    console.log('[PLAYWRIGHT MONITOR] Completed all checks');

  } catch (error) {
    console.error('[PLAYWRIGHT MONITOR] Failed to start browser:', error.message);

    // Log monitoring failure
    await logAgentAction({
      agent_id: 'playwright-monitor',
      agent_type: 'monitoring',
      action_type: 'browser_monitoring_failed',
      action_description: `Failed to start browser: ${error.message}`,
      action_success: false,
      action_details: {
        error: error.message,
        stack: error.stack
      }
    });

  } finally {
    // Always close browser
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Check a single page for console errors
 */
async function checkPage(browser, pageConfig) {
  const startTime = Date.now();
  const checkId = `CHK-BROWSER-${Date.now()}-${pageConfig.name.replace(/\s+/g, '-')}`;

  console.log(`[PLAYWRIGHT CHECK] ${pageConfig.name} - ${pageConfig.url}`);

  let context;
  let page;

  try {
    // Create new context
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Autonomous Monitor) Playwright/1.56'
    });

    page = await context.newPage();

    // Collect errors and warnings
    const errors = [];
    const warnings = [];

    // Listen for console messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push({
          message: msg.text(),
          location: msg.location(),
          timestamp: new Date().toISOString()
        });
      } else if (msg.type() === 'warning') {
        warnings.push({
          message: msg.text(),
          location: msg.location(),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      errors.push({
        message: `Unhandled error: ${error.message}`,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Navigate to page
    try {
      await page.goto(pageConfig.url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for any async errors
      await page.waitForTimeout(5000);

    } catch (navError) {
      errors.push({
        message: `Navigation failed: ${navError.message}`,
        timestamp: new Date().toISOString()
      });
    }

    const responseTime = Date.now() - startTime;

    // Log check to database
    const { error: checkError } = await query(
      `INSERT INTO monitoring_checks (check_id, check_type, target, application, status, response_time_ms, errors_detected, error_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        checkId,
        'browser',
        pageConfig.url,
        'admin-console-frontend',
        errors.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'healthy'),
        responseTime,
        errors.length,
        JSON.stringify({
          page_name: pageConfig.name,
          errors: errors.map(e => e.message),
          warnings: warnings.map(w => w.message)
        })
      ]
    );

    if (checkError) {
      console.error(`[PLAYWRIGHT] Failed to log check: ${checkError.message}`);
    }

    // Create incident if errors found
    if (errors.length > 0) {
      await handleBrowserErrors(page, checkId, pageConfig, errors, warnings);
    } else {
      console.log(`[PLAYWRIGHT OK] ${pageConfig.name} - No errors detected`);
    }

  } catch (error) {
    console.error(`[PLAYWRIGHT ERROR] ${pageConfig.name}:`, error.message);

    // Log check failure
    await query(
      `INSERT INTO monitoring_checks (check_id, check_type, target, application, status, errors_detected, error_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        checkId,
        'browser',
        pageConfig.url,
        'admin-console-frontend',
        'error',
        1,
        JSON.stringify({
          page_name: pageConfig.name,
          error: error.message,
          monitoring_failure: true
        })
      ]
    );

    // Create incident for monitoring failure
    await query(
      `INSERT INTO incidents (incident_id, title, error_message, error_type, severity, category, application, status, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        `INC-BROWSER-${Date.now()}`,
        `Browser monitoring failed: ${pageConfig.name}`,
        `Failed to monitor ${pageConfig.name}: ${error.message}`,
        'monitoring_failure',
        'HIGH',
        'infrastructure',
        'autonomous-monitoring-agent',
        'detected',
        JSON.stringify({
          page_name: pageConfig.name,
          page_url: pageConfig.url,
          error: error.message
        })
      ]
    );

  } finally {
    // Clean up
    if (context) {
      await context.close();
    }
  }
}

/**
 * Handle browser errors by creating incident and taking screenshot
 */
async function handleBrowserErrors(page, checkId, pageConfig, errors, warnings) {
  try {
    // Take screenshot
    const screenshot = await page.screenshot({ fullPage: true });
    const screenshotPath = path.join(
      __dirname,
      '../../screenshots',
      `${checkId}.png`
    );
    await fs.writeFile(screenshotPath, screenshot);

    console.log(`[PLAYWRIGHT] Screenshot saved: ${screenshotPath}`);

    // Determine severity
    const severity = pageConfig.critical ? 'HIGH' : 'MEDIUM';

    // Create incident
    const { rows, error: incidentError } = await query(
      `INSERT INTO incidents (incident_id, title, error_message, error_type, severity, category, application, status, stack_trace, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        `INC-BROWSER-${Date.now()}`,
        `Browser error on ${pageConfig.name}`,
        errors[0].message,
        'browser_console_error',
        severity,
        'frontend',
        'admin-console-frontend',
        'detected',
        errors[0].stack || null,
        JSON.stringify({
          page_name: pageConfig.name,
          page_url: pageConfig.url,
          errors: errors,
          warnings: warnings,
          screenshot_path: screenshotPath,
          check_id: checkId
        })
      ]
    );

    if (incidentError) {
      console.error(`[PLAYWRIGHT] Failed to create incident: ${incidentError.message}`);
      return;
    }

    const incident = rows[0];

    console.error(`[PLAYWRIGHT ERROR] ${pageConfig.name} - ${errors.length} errors detected`);
    console.error(`  First error: ${errors[0].message}`);
    console.error(`  Incident: ${incident.incident_id}`);

    // Log action
    await logAgentAction({
      agent_id: 'playwright-monitor',
      agent_type: 'monitoring',
      action_type: 'browser_error_detected',
      action_description: `Browser error detected on ${pageConfig.name}: ${errors[0].message.substring(0, 100)}`,
      action_success: true,
      incident_id: incident?.id,
      action_details: {
        errors_count: errors.length,
        warnings_count: warnings.length,
        page: pageConfig.name,
        screenshot: screenshotPath
      }
    });

  } catch (error) {
    console.error('[PLAYWRIGHT] Failed to handle errors:', error.message);
  }
}

module.exports = { monitorBrowserErrors };
