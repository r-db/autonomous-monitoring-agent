const { Server } = require('socket.io');
const { query } = require('../config/database');

/**
 * WebSocket Server for Real-time Updates
 */

class WebSocketServer {
  constructor() {
    this.io = null;
    this.clients = new Map();
  }

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST']
      },
      path: '/ws'
    });

    this.io.on('connection', (socket) => {
      console.log(`[WS] Client connected: ${socket.id}`);
      this.clients.set(socket.id, socket);

      // Send current stats on connect
      this.sendInitialStats(socket);

      socket.on('disconnect', () => {
        console.log(`[WS] Client disconnected: ${socket.id}`);
        this.clients.delete(socket.id);
      });

      socket.on('subscribe', (channel) => {
        socket.join(channel);
        console.log(`[WS] Client ${socket.id} subscribed to ${channel}`);
      });

      socket.on('unsubscribe', (channel) => {
        socket.leave(channel);
        console.log(`[WS] Client ${socket.id} unsubscribed from ${channel}`);
      });
    });

    console.log('[WS] WebSocket server initialized');
    return this.io;
  }

  /**
   * Send initial statistics to new client
   */
  async sendInitialStats(socket) {
    try {
      const stats = await this.getSystemStats();
      socket.emit('initial_stats', stats);
    } catch (error) {
      console.error('[WS] Failed to send initial stats:', error);
    }
  }

  /**
   * Get current system statistics
   */
  async getSystemStats() {
    const { rows: incidents } = await query(
      `SELECT status, COUNT(*) as count
       FROM incidents
       WHERE detected_at > NOW() - INTERVAL '24 hours'
       GROUP BY status`,
      []
    );

    const { rows: checks } = await query(
      `SELECT check_type, COUNT(*) as count
       FROM monitoring_checks
       WHERE timestamp > NOW() - INTERVAL '1 hour'
       GROUP BY check_type`,
      []
    );

    const { rows: fixes } = await query(
      `SELECT success, COUNT(*) as count
       FROM fix_attempts
       WHERE attempted_at > NOW() - INTERVAL '24 hours'
       GROUP BY success`,
      []
    );

    return {
      incidents: incidents.reduce((acc, r) => ({ ...acc, [r.status]: parseInt(r.count) }), {}),
      checks: checks.reduce((acc, r) => ({ ...acc, [r.check_type]: parseInt(r.count) }), {}),
      fixes: fixes.reduce((acc, r) => ({ ...acc, [r.success ? 'successful' : 'failed']: parseInt(r.count) }), {})
    };
  }

  /**
   * Broadcast incident detection
   */
  async broadcastIncident(incident) {
    if (!this.io) return;

    this.io.emit('incident_detected', {
      incident_id: incident.incident_id,
      title: incident.title,
      severity: incident.severity,
      category: incident.category,
      detected_at: incident.detected_at
    });

    console.log(`[WS] Broadcasted incident: ${incident.incident_id}`);
  }

  /**
   * Broadcast fix attempt
   */
  async broadcastFixAttempt(incidentId, status, details) {
    if (!this.io) return;

    this.io.emit('fix_attempt', {
      incident_id: incidentId,
      status,
      details,
      timestamp: new Date().toISOString()
    });

    console.log(`[WS] Broadcasted fix attempt: ${incidentId} - ${status}`);
  }

  /**
   * Broadcast fix completion
   */
  async broadcastFixComplete(incidentId, success, result) {
    if (!this.io) return;

    this.io.emit('fix_complete', {
      incident_id: incidentId,
      success,
      result,
      timestamp: new Date().toISOString()
    });

    console.log(`[WS] Broadcasted fix complete: ${incidentId} - ${success ? 'SUCCESS' : 'FAILED'}`);
  }

  /**
   * Broadcast monitoring check result
   */
  async broadcastCheckResult(checkType, target, status) {
    if (!this.io) return;

    this.io.to('monitoring').emit('check_result', {
      check_type: checkType,
      target,
      status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast system stats update
   */
  async broadcastStatsUpdate() {
    if (!this.io) return;

    try {
      const stats = await this.getSystemStats();
      this.io.emit('stats_update', stats);
    } catch (error) {
      console.error('[WS] Failed to broadcast stats:', error);
    }
  }

  /**
   * Get connected clients count
   */
  getClientCount() {
    return this.clients.size;
  }
}

module.exports = new WebSocketServer();
