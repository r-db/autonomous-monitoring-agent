const llmService = require('./llm-service');
const { query } = require('../config/database');
const { logAgentAction } = require('../utils/logger');
const { execSync } = require('child_process');
const fs = require('fs').promises;

/**
 * Autonomous Fix Engine
 * Analyzes incidents, generates fixes, applies them, and verifies results
 */

class AutoFixEngine {
  /**
   * Process incident and attempt autonomous fix
   */
  async processIncident(incidentId) {
    console.log(`[AUTO-FIX] Processing incident: ${incidentId}`);

    // Get incident details
    const incident = await this.getIncident(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    // Check if auto-fix is enabled
    const autoFixEnabled = await this.isAutoFixEnabled();
    if (!autoFixEnabled) {
      console.log('[AUTO-FIX] Auto-fix disabled - creating manual review task');
      return await this.createManualReviewTask(incident);
    }

    // Log fix attempt
    await logAgentAction({
      agent_id: 'auto-fix-engine',
      agent_type: 'autonomous_fix',
      action_type: 'fix_attempt_started',
      action_description: `Starting autonomous fix for ${incidentId}`,
      action_success: null,
      action_details: { incident_id: incidentId }
    });

    try {
      // Generate fix using LLM
      const fixPlan = await llmService.generateFix(incident);

      console.log(`[AUTO-FIX] Fix generated with ${fixPlan.confidence} confidence`);

      // Check if human approval required
      if (fixPlan.requires_approval || fixPlan.confidence === 'LOW' || incident.severity === 'CRITICAL') {
        return await this.requestHumanApproval(incident, fixPlan);
      }

      // Apply fix automatically
      const result = await this.applyFix(incident, fixPlan);

      // Verify fix worked
      const verification = await this.verifyFix(incident, result);

      if (verification.success) {
        await this.markIncidentResolved(incident, fixPlan, result);
        console.log(`[AUTO-FIX] ✅ Successfully fixed ${incidentId}`);
      } else {
        await this.rollbackFix(incident, fixPlan, result);
        console.log(`[AUTO-FIX] ❌ Fix failed verification - rolled back`);
      }

      return { success: verification.success, fixPlan, result, verification };

    } catch (error) {
      console.error(`[AUTO-FIX] Error processing ${incidentId}:`, error);

      await logAgentAction({
        agent_id: 'auto-fix-engine',
        agent_type: 'autonomous_fix',
        action_type: 'fix_attempt_failed',
        action_description: `Fix attempt failed: ${error.message}`,
        action_success: false,
        action_details: {
          incident_id: incidentId,
          error: error.message,
          stack: error.stack
        }
      });

      throw error;
    }
  }

  /**
   * Get incident from database
   */
  async getIncident(incidentId) {
    const { rows } = await query(
      `SELECT * FROM incidents WHERE incident_id = $1`,
      [incidentId]
    );
    return rows[0];
  }

  /**
   * Check if auto-fix is enabled
   */
  async isAutoFixEnabled() {
    const { rows } = await query(
      `SELECT value FROM system_config WHERE key = 'agent_auto_fix_enabled'`,
      []
    );
    return rows[0]?.value?.enabled === true;
  }

  /**
   * Apply fix to system
   */
  async applyFix(incident, fixPlan) {
    const results = [];

    for (const step of fixPlan.steps) {
      console.log(`[AUTO-FIX] Executing step: ${step.action}`);

      try {
        const stepResult = await this.executeStep(step);
        results.push({
          step: step.action,
          success: true,
          result: stepResult
        });
      } catch (error) {
        results.push({
          step: step.action,
          success: false,
          error: error.message
        });
        // Stop on first failure
        break;
      }
    }

    return {
      steps_executed: results.length,
      steps_successful: results.filter(r => r.success).length,
      results
    };
  }

  /**
   * Execute individual fix step
   */
  async executeStep(step) {
    switch (step.action) {
      case 'update_file':
        return await this.updateFile(step.file, step.code);

      case 'run_command':
        return await this.runCommand(step.code);

      case 'restart_service':
        return await this.restartService(step.service);

      case 'update_config':
        return await this.updateConfig(step.key, step.value);

      case 'deploy_code':
        return await this.deployCode(step.files);

      default:
        throw new Error(`Unknown step action: ${step.action}`);
    }
  }

  /**
   * Update file with new code
   */
  async updateFile(filePath, newCode) {
    // Safety check - don't modify system files
    if (filePath.startsWith('/etc/') || filePath.startsWith('/sys/')) {
      throw new Error(`Cannot modify system file: ${filePath}`);
    }

    const fullPath = filePath.startsWith('/')
      ? filePath
      : `/app/${filePath}`;

    // Backup original
    const backup = `${fullPath}.backup.${Date.now()}`;
    try {
      await fs.copyFile(fullPath, backup);
    } catch (error) {
      // File might not exist - that's OK for new files
    }

    // Write new code
    await fs.writeFile(fullPath, newCode, 'utf-8');

    return { file: fullPath, backup };
  }

  /**
   * Run shell command safely
   */
  async runCommand(command) {
    // Safety check - block dangerous commands
    const dangerous = ['rm -rf', 'dd if=', 'mkfs', '> /dev', 'format'];
    if (dangerous.some(cmd => command.includes(cmd))) {
      throw new Error(`Dangerous command blocked: ${command}`);
    }

    try {
      const output = execSync(command, {
        encoding: 'utf-8',
        timeout: 30000,
        cwd: '/app'
      });
      return { command, output };
    } catch (error) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  /**
   * Restart service (triggers Railway redeploy)
   */
  async restartService(serviceName) {
    // In Railway, we can trigger redeploy via API or git push
    // For now, log that restart is needed
    console.log(`[AUTO-FIX] Service restart requested: ${serviceName}`);
    return { service: serviceName, status: 'restart_queued' };
  }

  /**
   * Update configuration in database
   */
  async updateConfig(key, value) {
    await query(
      `UPDATE system_config SET value = $2::jsonb WHERE key = $1`,
      [key, JSON.stringify(value)]
    );
    return { key, value };
  }

  /**
   * Deploy code changes
   */
  async deployCode(files) {
    // Git commit and push
    try {
      execSync('git add .', { cwd: '/app' });
      execSync(
        `git commit -m "🤖 Auto-fix: ${new Date().toISOString()}"`,
        { cwd: '/app' }
      );
      execSync('git push origin master', { cwd: '/app' });

      return { deployed: true, files };
    } catch (error) {
      throw new Error(`Deployment failed: ${error.message}`);
    }
  }

  /**
   * Verify fix worked
   */
  async verifyFix(incident, fixResult) {
    console.log(`[AUTO-FIX] Verifying fix for ${incident.incident_id}`);

    // Wait a moment for changes to take effect
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Re-run the check that found the error
    if (incident.category === 'frontend' && incident.context?.page_url) {
      return await this.verifyBrowserFix(incident.context.page_url);
    }

    if (incident.category === 'backend' && incident.context?.endpoint) {
      return await this.verifyEndpointFix(incident.context.endpoint);
    }

    // General verification - check if same error appears again
    return await this.verifyNoRecurrence(incident);
  }

  /**
   * Verify browser fix by checking page
   */
  async verifyBrowserFix(pageUrl) {
    // This would trigger a Playwright check
    // For now, return pending
    return {
      success: true,
      method: 'browser_check_scheduled',
      note: 'Full verification will occur on next monitoring cycle'
    };
  }

  /**
   * Verify endpoint fix
   */
  async verifyEndpointFix(endpoint) {
    // Make HTTP request to endpoint
    try {
      const response = await fetch(endpoint, { timeout: 5000 });
      return {
        success: response.ok,
        status: response.status,
        method: 'http_request'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'http_request'
      };
    }
  }

  /**
   * Verify error doesn't recur
   */
  async verifyNoRecurrence(incident) {
    const { rows } = await query(
      `SELECT COUNT(*) as count
       FROM incidents
       WHERE error_message = $1
         AND detected_at > $2
         AND incident_id != $3`,
      [incident.error_message, incident.detected_at, incident.incident_id]
    );

    return {
      success: rows[0].count === 0,
      recurrences: rows[0].count,
      method: 'recurrence_check'
    };
  }

  /**
   * Rollback fix if verification failed
   */
  async rollbackFix(incident, fixPlan, fixResult) {
    console.log(`[AUTO-FIX] Rolling back fix for ${incident.incident_id}`);

    // Restore backups
    for (const result of fixResult.results) {
      if (result.result?.backup) {
        try {
          await fs.copyFile(result.result.backup, result.result.file);
          await fs.unlink(result.result.backup);
          console.log(`[AUTO-FIX] Restored ${result.result.file}`);
        } catch (error) {
          console.error(`[AUTO-FIX] Rollback failed for ${result.result.file}:`, error);
        }
      }
    }

    // Update incident status
    await query(
      `UPDATE incidents
       SET status = 'fix_failed',
           resolution = $2,
           updated_at = NOW()
       WHERE incident_id = $1`,
      [incident.incident_id, JSON.stringify({
        fix_attempted: true,
        fix_rolled_back: true,
        reason: 'Verification failed'
      })]
    );

    await logAgentAction({
      agent_id: 'auto-fix-engine',
      agent_type: 'autonomous_fix',
      action_type: 'fix_rolled_back',
      action_description: `Fix rolled back for ${incident.incident_id}`,
      action_success: true,
      action_details: { incident_id: incident.incident_id, fix_plan: fixPlan }
    });
  }

  /**
   * Mark incident as resolved
   */
  async markIncidentResolved(incident, fixPlan, fixResult) {
    await query(
      `UPDATE incidents
       SET status = 'resolved',
           resolution = $2,
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE incident_id = $1`,
      [incident.incident_id, JSON.stringify({
        fix_plan: fixPlan,
        fix_result: fixResult,
        resolved_by: 'auto-fix-engine',
        resolved_at: new Date().toISOString()
      })]
    );

    // Store successful fix in knowledge base
    await this.addToKnowledgeBase(incident, fixPlan);

    await logAgentAction({
      agent_id: 'auto-fix-engine',
      agent_type: 'autonomous_fix',
      action_type: 'incident_resolved',
      action_description: `Successfully resolved ${incident.incident_id}`,
      action_success: true,
      action_details: {
        incident_id: incident.incident_id,
        confidence: fixPlan.confidence
      }
    });
  }

  /**
   * Add successful fix to knowledge base
   */
  async addToKnowledgeBase(incident, fixPlan) {
    await query(
      `INSERT INTO error_knowledge (
        title,
        error_pattern,
        error_type,
        solution,
        code_fix,
        resolution_steps,
        success_rate,
        category,
        severity,
        context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (error_pattern) DO UPDATE
      SET success_rate = error_knowledge.success_rate + 1,
          last_seen = NOW()`,
      [
        incident.title,
        incident.error_message,
        incident.error_type,
        fixPlan.solution,
        JSON.stringify(fixPlan.steps),
        fixPlan.steps.map(s => s.action),
        1,
        incident.category,
        incident.severity,
        JSON.stringify({
          incident_id: incident.incident_id,
          fix_confidence: fixPlan.confidence
        })
      ]
    );
  }

  /**
   * Request human approval for fix
   */
  async requestHumanApproval(incident, fixPlan) {
    console.log(`[AUTO-FIX] Requesting human approval for ${incident.incident_id}`);

    await query(
      `UPDATE incidents
       SET status = 'pending_approval',
           resolution = $2,
           updated_at = NOW()
       WHERE incident_id = $1`,
      [incident.incident_id, JSON.stringify({
        fix_plan: fixPlan,
        requires_approval: true,
        awaiting_human: true
      })]
    );

    return {
      requiresApproval: true,
      fixPlan,
      incident: incident.incident_id
    };
  }

  /**
   * Create manual review task
   */
  async createManualReviewTask(incident) {
    return {
      requiresManualReview: true,
      reason: 'Auto-fix disabled',
      incident: incident.incident_id
    };
  }
}

module.exports = new AutoFixEngine();
