const { chromium } = require('playwright');
const { supabase } = require('../config/database');
const { logAgentAction } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const ADMIN_CONSOLE_URL = process.env.ADMIN_CONSOLE_URL || 'https://admin.ib365.ai';

// Pages to monitor
const PAGES_TO_MONITOR = [
  { url: `${ADMIN_CONSOLE_URL}/`, name: 'Dashboard', critical: true },
  { url: `${ADMIN_CONSOLE_URL}/agents`, name: 'Agents', critical: true },
  { url: `${ADMIN_CONSOLE_URL}/token-budget`, name: 'Token Budget', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/tenants`, name: 'Tenants', critical: true },
  { url: `${ADMIN_CONSOLE_URL}/settings`, name: 'Settings', critical: false }
];

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
    const { error: checkError } = await supabase.from('monitoring_checks').insert({
      check_id: checkId,
      check_type: 'browser',
      target: pageConfig.url,
      application: 'admin-console-frontend',
      status: errors.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'healthy'),
      response_time_ms: responseTime,
      errors_detected: errors.length,
      error_details: {
        page_name: pageConfig.name,
        errors: errors.map(e => e.message),
        warnings: warnings.map(w => w.message)
      }
    });

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
    await supabase.from('monitoring_checks').insert({
      check_id: checkId,
      check_type: 'browser',
      target: pageConfig.url,
      application: 'admin-console-frontend',
      status: 'error',
      errors_detected: 1,
      error_details: {
        page_name: pageConfig.name,
        error: error.message,
        monitoring_failure: true
      }
    });

    // Create incident for monitoring failure
    await supabase.from('incidents').insert({
      incident_id: `INC-BROWSER-${Date.now()}`,
      title: `Browser monitoring failed: ${pageConfig.name}`,
      error_message: `Failed to monitor ${pageConfig.name}: ${error.message}`,
      error_type: 'monitoring_failure',
      severity: 'HIGH',
      category: 'infrastructure',
      application: 'autonomous-monitoring-agent',
      status: 'detected',
      context: {
        page_name: pageConfig.name,
        page_url: pageConfig.url,
        error: error.message
      }
    });

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
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .insert({
        incident_id: `INC-BROWSER-${Date.now()}`,
        title: `Browser error on ${pageConfig.name}`,
        error_message: errors[0].message,
        error_type: 'browser_console_error',
        severity: severity,
        category: 'frontend',
        application: 'admin-console-frontend',
        status: 'detected',
        stack_trace: errors[0].stack || null,
        context: {
          page_name: pageConfig.name,
          page_url: pageConfig.url,
          errors: errors,
          warnings: warnings,
          screenshot_path: screenshotPath,
          check_id: checkId
        }
      })
      .select()
      .single();

    if (incidentError) {
      console.error(`[PLAYWRIGHT] Failed to create incident: ${incidentError.message}`);
      return;
    }

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
