const { supabase } = require('../config/database');

/**
 * Log agent action to database for audit trail
 */
async function logAgentAction(action) {
  try {
    const { error } = await supabase.from('agent_actions').insert({
      agent_id: action.agent_id,
      agent_type: action.agent_type,
      action_type: action.action_type,
      action_description: action.action_description,
      action_success: action.action_success !== undefined ? action.action_success : true,
      incident_id: action.incident_id || null,
      error_knowledge_id: action.error_knowledge_id || null,
      safety_checks_passed: action.safety_checks_passed || null,
      action_details: action.action_details || {}
    });

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
