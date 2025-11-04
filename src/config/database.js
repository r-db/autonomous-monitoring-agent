const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client for database operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    db: { schema: 'public' },
    auth: { persistSession: false },
    global: {
      headers: {
        'x-application': 'autonomous-monitoring-agent'
      }
    }
  }
);

// Test database connection
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('key')
      .limit(1);

    if (error) {
      console.error('[DATABASE] Connection test failed:', error.message);
      return false;
    }

    console.log('[DATABASE] Connection successful');
    return true;
  } catch (err) {
    console.error('[DATABASE] Connection error:', err.message);
    return false;
  }
}

module.exports = { supabase, testConnection };
