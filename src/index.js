const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');
const { testConnection } = require('./config/database');
const { startMonitoring, stopMonitoring } = require('./cron/monitoring-cron');
const { logAgentAction } = require('./utils/logger');
const { validateEnv } = require('./utils/env-validator');
const { authenticateAPIKey } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rate-limit');

// Load environment variables
dotenv.config();

// Validate environment BEFORE starting server
validateEnv();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001'];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Middleware - REDUCE from 10mb to 100kb
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// Routes
const healthRoutes = require('./routes/health');
const errorReportingRoutes = require('./routes/error-reporting');
const triggerRoutes = require('./routes/trigger');

// Health routes (no auth required)
app.use(healthRoutes);

// Apply authentication and rate limiting to all /api/autonomous routes
app.use('/api/autonomous', authenticateAPIKey);
app.use('/api/autonomous', apiLimiter);

// API routes (protected by auth and rate limiting)
app.use(errorReportingRoutes);
app.use(triggerRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Autonomous Monitoring Agent',
    version: '1.0.0-week1-frontend',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      status: '/status',
      error_reporting: '/api/autonomous/error',
      incidents: '/api/autonomous/incidents',
      trigger: '/api/autonomous/trigger',
      trigger_browser: '/api/autonomous/trigger/browser',
      trigger_security: '/api/autonomous/trigger/security',
      trigger_health: '/api/autonomous/trigger/health',
      trigger_test_error: '/api/autonomous/trigger-test-error',
      system_status: '/api/autonomous/status'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Track monitoring jobs
let monitoringJobs = null;

// Graceful shutdown handler
const shutdown = async (signal) => {
  console.log(`\n[SHUTDOWN] Received ${signal}, shutting down gracefully...`);

  // Stop monitoring jobs
  if (monitoringJobs) {
    stopMonitoring(monitoringJobs);
  }

  // Log shutdown
  await logAgentAction({
    agent_id: 'monitoring-service',
    agent_type: 'monitoring',
    action_type: 'service_shutdown',
    action_description: `Service shutting down due to ${signal}`,
    action_success: true
  });

  // Close server
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('[SHUTDOWN] Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Start server
const server = app.listen(PORT, async () => {
  console.log('\n========================================');
  console.log('🚀 Autonomous Monitoring Agent');
  console.log('========================================');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Port: ${PORT}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('========================================\n');

  // Test database connection
  console.log('[STARTUP] Testing database connection...');
  const dbConnected = await testConnection();

  if (!dbConnected) {
    console.error('[STARTUP] WARNING: Database connection failed');
    console.error('[STARTUP] Service will continue but monitoring may not work');
  }

  // Start monitoring
  console.log('[STARTUP] Starting monitoring services...');
  monitoringJobs = startMonitoring();

  // Log startup
  await logAgentAction({
    agent_id: 'monitoring-service',
    agent_type: 'monitoring',
    action_type: 'service_startup',
    action_description: 'Monitoring service started successfully',
    action_success: true,
    action_details: {
      port: PORT,
      environment: process.env.NODE_ENV,
      database_connected: dbConnected
    }
  });

  console.log('\n✅ Service ready and operational\n');
});

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);

  logAgentAction({
    agent_id: 'monitoring-service',
    agent_type: 'monitoring',
    action_type: 'uncaught_exception',
    action_description: `Uncaught exception: ${err.message}`,
    action_success: false,
    action_details: {
      error: err.message,
      stack: err.stack
    }
  }).then(() => {
    process.exit(1);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);

  logAgentAction({
    agent_id: 'monitoring-service',
    agent_type: 'monitoring',
    action_type: 'unhandled_rejection',
    action_description: `Unhandled promise rejection: ${reason}`,
    action_success: false,
    action_details: {
      reason: String(reason)
    }
  });
});

module.exports = app;
