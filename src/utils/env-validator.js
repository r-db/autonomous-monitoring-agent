const validateEnv = () => {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('[ENV ERROR] Missing required environment variables:', missing);
    console.error('[ENV ERROR] Please check your .env file');
    process.exit(1);
  }

  // Validate URL format
  try {
    new URL(process.env.SUPABASE_URL);
  } catch (e) {
    console.error('[ENV ERROR] SUPABASE_URL is not a valid URL');
    process.exit(1);
  }

  // Validate API key length
  if (process.env.API_KEY.length < 32) {
    console.warn('[ENV WARNING] API_KEY should be at least 32 characters for security');
  }

  console.log('[ENV] Environment variables validated successfully');
};

module.exports = { validateEnv };
