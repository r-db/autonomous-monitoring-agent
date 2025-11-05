const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const llmService = require('../services/llm-service');
const { authenticateAPIKey } = require('../middleware/auth');

/**
 * LLM Configuration API
 */

// Get current LLM configuration
router.get('/config', authenticateAPIKey, async (req, res) => {
  try {
    const { rows: providerRows } = await query(
      "SELECT value FROM system_config WHERE key = 'active_llm_provider'",
      []
    );

    const { rows: modelRows } = await query(
      "SELECT value FROM system_config WHERE key = 'llm_model_config'",
      []
    );

    const { rows: autoFixRows } = await query(
      "SELECT value FROM system_config WHERE key = 'agent_auto_fix_enabled'",
      []
    );

    res.json({
      provider: providerRows[0]?.value?.provider || 'claude',
      models: modelRows[0]?.value || {},
      autoFixEnabled: autoFixRows[0]?.value?.enabled || false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update LLM provider
router.post('/provider', authenticateAPIKey, async (req, res) => {
  try {
    const { provider } = req.body;

    if (!['claude', 'openai'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    await query(
      `UPDATE system_config
       SET value = jsonb_set(value, '{provider}', to_jsonb($1::text))
       WHERE key = 'active_llm_provider'`,
      [provider]
    );

    res.json({ success: true, provider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update model configuration
router.post('/model', authenticateAPIKey, async (req, res) => {
  try {
    const { provider, model, maxTokens, temperature } = req.body;

    const config = {
      model,
      maxTokens: maxTokens || 4096,
      temperature: temperature || 0.7
    };

    await query(
      `UPDATE system_config
       SET value = jsonb_set(value, '{${provider}}', $1::jsonb)
       WHERE key = 'llm_model_config'`,
      [JSON.stringify(config)]
    );

    res.json({ success: true, provider, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle auto-fix
router.post('/auto-fix/toggle', authenticateAPIKey, async (req, res) => {
  try {
    const { enabled } = req.body;

    await query(
      `UPDATE system_config
       SET value = jsonb_set(value, '{enabled}', to_jsonb($1::boolean))
       WHERE key = 'agent_auto_fix_enabled'`,
      [enabled]
    );

    res.json({ success: true, enabled });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get LLM usage statistics
router.get('/usage', authenticateAPIKey, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM llm_usage_analytics
       ORDER BY date DESC
       LIMIT 30`,
      []
    );

    res.json({ usage: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test LLM connection
router.post('/test', authenticateAPIKey, async (req, res) => {
  try {
    const { provider } = req.body;

    const testIncident = {
      incident_id: 'TEST-' + Date.now(),
      title: 'Test incident',
      error_message: 'Test error for LLM connectivity',
      error_type: 'test',
      severity: 'LOW',
      category: 'test'
    };

    const result = await llmService.generateFix(testIncident, {
      test: true
    });

    res.json({
      success: true,
      provider,
      response: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
