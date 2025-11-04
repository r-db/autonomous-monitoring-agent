const { Pool } = require('pg');
require('dotenv').config();

// Neon PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test database connection
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as now');
    console.log('[DATABASE] ✅ Connection successful');
    return true;
  } catch (err) {
    console.error('[DATABASE] Connection test failed:', err);
    return false;
  }
}

// Query helper with error handling
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    return { rows: res.rows, error: null, duration };
  } catch (error) {
    const duration = Date.now() - start;
    console.error('[DATABASE] Query error:', error.message);
    return { rows: [], error, duration };
  }
}

// Graceful shutdown
async function shutdown() {
  await pool.end();
  console.log('[DATABASE] Connection pool closed');
}

module.exports = { pool, query, testConnection, shutdown };
