const validateEnv = () => {
  const required = [
    'DATABASE_URL',
    'API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('[ENV ERROR] Missing required environment variables:', missing);
    console.error('[ENV ERROR] Please check your .env file');
    process.exit(1);
  }

  // Validate DATABASE_URL is a valid PostgreSQL connection string
  if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
    console.error('[ENV ERROR] DATABASE_URL must be a valid PostgreSQL connection string');
    process.exit(1);
  }

  // Validate API key length
  if (process.env.API_KEY.length < 32) {
    console.warn('[ENV WARNING] API_KEY should be at least 32 characters for security');
  }

  console.log('[ENV] Environment variables validated successfully');
};

module.exports = { validateEnv };
