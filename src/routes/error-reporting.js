const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');
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
    const { data: incident, error: dbError } = await supabase
      .from('incidents')
      .insert({
        incident_id: incidentId,
        title: sanitizedMessage.substring(0, 255),
        error_message: sanitizedMessage,
        error_type: error.type || 'unknown',
        severity: finalSeverity,
        category: finalCategory,
        application: context?.application || 'unknown',
        status: 'detected',
        stack_trace: error.stack || null,
        endpoint: context?.endpoint || null,
        context: context || {}
      })
      .select()
      .single();

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

    let query = supabase
      .from('incidents')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: incidents, error } = await query;

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

    const { data: incident, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('incident_id', incidentId)
      .single();

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
