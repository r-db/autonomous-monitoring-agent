const { query } = require('../config/database');

/**
 * Log agent action to database for audit trail
 */
async function logAgentAction(action) {
  try {
    const { error } = await query(
      `INSERT INTO agent_actions (agent_id, agent_type, action_type, action_description, action_success, incident_id, error_knowledge_id, safety_checks_passed, action_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        action.agent_id,
        action.agent_type,
        action.action_type,
        action.action_description,
        action.action_success !== undefined ? action.action_success : true,
        action.incident_id || null,
        action.error_knowledge_id || null,
        action.safety_checks_passed || null,
        JSON.stringify(action.action_details || {})
      ]
    );

    if (error) {
      console.error('[LOGGER] Failed to log action:', error.message);
    }
  } catch (err) {
    console.error('[LOGGER] Exception logging action:', err.message);
  }
}

/**
 * Console logger with timestamp
 */
function log(level, message, details = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (level === 'error') {
    console.error(logMessage, details || '');
  } else {
    console.log(logMessage, details || '');
  }
}

module.exports = { logAgentAction, log };
