const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { classifyError, generateIncidentId, sanitizeErrorMessage } = require('../services/error-classifier');
const { logAgentAction } = require('../utils/logger');
const { validateErrorCreation, validateIncidentId } = require('../middleware/validation');
const { errorCreationLimiter } = require('../middleware/rate-limit');

/**
 * POST /api/autonomous/error
 * Receive error reports from Sentry or manual sources
 */
router.post('/api/autonomous/error', errorCreationLimiter, async (req, res) => {
  try {
    const { error, context, severity, source } = req.body;

    // Validate input
    if (!error || !error.message) {
      return res.status(400).json({
        error: 'Invalid error format',
        message: 'Error object must contain a message property'
      });
    }

    // Generate incident ID
    const incidentId = generateIncidentId();

    // Classify error
    const classification = classifyError(error, context);
    const finalSeverity = severity || classification.severity;
    const finalCategory = classification.category;

    // Sanitize error message
    const sanitizedMessage = sanitizeErrorMessage(error.message);

    // Create incident
    const { rows, error: dbError } = await query(
      `INSERT INTO incidents (incident_id, title, error_message, error_type, severity, category, application, status, stack_trace, endpoint, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        incidentId,
        sanitizedMessage.substring(0, 255),
        sanitizedMessage,
        error.type || 'unknown',
        finalSeverity,
        finalCategory,
        context?.application || 'unknown',
        'detected',
        error.stack || null,
        context?.endpoint || null,
        JSON.stringify(context || {})
      ]
    );
    const incident = rows[0];

    if (dbError) {
      console.error('[ERROR REPORTING] Database error:', dbError.message);
      return res.status(500).json({
        error: 'Failed to create incident',
        message: dbError.message
      });
    }

    // Log action
    await logAgentAction({
      agent_id: 'monitoring-service',
      agent_type: 'monitoring',
      action_type: 'error_detected',
      action_description: `Error detected from ${source || 'unknown'}: ${sanitizedMessage.substring(0, 100)}`,
      action_success: true,
      incident_id: incident.id,
      action_details: {
        source,
        severity: finalSeverity,
        category: finalCategory
      }
    });

    console.log(`[INCIDENT CREATED] ${incidentId} - ${finalSeverity} - ${sanitizedMessage.substring(0, 100)}`);

    // Return incident details
    res.status(201).json({
      incident_id: incidentId,
      created: true,
      severity: finalSeverity,
      category: finalCategory,
      status: 'detected',
      timestamp: incident.detected_at
    });

  } catch (err) {
    console.error('[ERROR REPORTING] Exception:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message
    });
  }
});

/**
 * GET /api/autonomous/incidents
 * List recent incidents
 */
router.get('/api/autonomous/incidents', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status;

    let sqlQuery = 'SELECT * FROM incidents';
    let params = [];

    if (status) {
      sqlQuery += ' WHERE status = $1';
      params.push(status);
      sqlQuery += ' ORDER BY detected_at DESC LIMIT $2';
      params.push(limit);
    } else {
      sqlQuery += ' ORDER BY detected_at DESC LIMIT $1';
      params.push(limit);
    }

    const { rows: incidents, error } = await query(sqlQuery, params);

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch incidents',
        message: error.message
      });
    }

    res.json({
      incidents,
      count: incidents.length,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[ERROR REPORTING] Failed to list incidents:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message
    });
  }
});

/**
 * GET /api/autonomous/incidents/:id
 * Get incident details by incident_id
 */
router.get('/api/autonomous/incidents/:id', async (req, res) => {
  try {
    const incidentId = req.params.id;

    const { rows, error } = await query(
      'SELECT * FROM incidents WHERE incident_id = $1',
      [incidentId]
    );
    const incident = rows[0];

    if (error || !incident) {
      return res.status(404).json({
        error: 'Incident not found',
        incident_id: incidentId
      });
    }

    res.json({
      incident,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[ERROR REPORTING] Failed to fetch incident:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message
    });
  }
});

module.exports = router;
