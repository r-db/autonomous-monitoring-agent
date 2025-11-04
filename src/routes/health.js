const express = require('express');
const router = express.Router();
const { testConnection } = require('../config/database');

/**
 * GET /health
 * Basic health check endpoint for Railway
 */
router.get('/health', async (req, res) => {
  try {
    const dbHealthy = await testConnection();

    const health = {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbHealthy ? 'connected' : 'disconnected'
    };

    res.status(dbHealthy ? 200 : 503).json(health);
  } catch (err) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: err.message
    });
  }
});

/**
 * GET /health/db
 * Database-specific health check
 */
router.get('/health/db', async (req, res) => {
  try {
    const dbHealthy = await testConnection();

    res.status(dbHealthy ? 200 : 503).json({
      status: dbHealthy ? 'healthy' : 'error',
      timestamp: new Date().toISOString(),
      database: dbHealthy ? 'connected' : 'disconnected'
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: err.message
    });
  }
});

/**
 * GET /status
 * Detailed system status
 */
router.get('/status', async (req, res) => {
  try {
    const dbHealthy = await testConnection();

    res.json({
      agent_enabled: true,
      monitoring_active: true,
      auto_fix_enabled: false, // Week 3+
      database_connected: dbHealthy,
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: '1.0.0-week1'
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to retrieve status',
      message: err.message
    });
  }
});

module.exports = router;
