/**
 * Classify error severity based on error message and context
 */
function classifyError(error, context) {
  const errorMessage = (error.message || '').toLowerCase();
  const errorType = (error.type || '').toLowerCase();

  // Severity classification rules
  const rules = {
    CRITICAL: [
      /database connection failed/i,
      /502 bad gateway/i,
      /503 service unavailable/i,
      /authentication service down/i,
      /security breach/i,
      /data loss/i,
      /cannot connect to database/i,
      /redis connection failed/i,
      /cors.*blocked/i
    ],
    HIGH: [
      /api timeout/i,
      /500 internal server error/i,
      /payment processing failed/i,
      /cannot read property/i,
      /syntax error/i,
      /undefined is not a function/i,
      /typeerror/i,
      /referenceerror/i,
      /fetch.*failed/i,
      /network.*error/i
    ],
    MEDIUM: [
      /slow query/i,
      /rate limit approaching/i,
      /cache miss/i,
      /timeout warning/i,
      /deprecation/i,
      /429.*too many requests/i
    ],
    LOW: [
      /warning/i,
      /missing image/i,
      /404/i,
      /not found/i
    ]
  };

  // Determine severity
  let severity = 'MEDIUM'; // default
  for (const [level, patterns] of Object.entries(rules)) {
    if (patterns.some(p => p.test(errorMessage) || p.test(errorType))) {
      severity = level;
      break;
    }
  }

  // Category inference
  let category = 'unknown';

  if (context?.endpoint || errorType.includes('api')) {
    category = 'backend';
  } else if (context?.application?.includes('frontend') || errorMessage.includes('browser')) {
    category = 'frontend';
  } else if (errorMessage.includes('db') || errorMessage.includes('database') || errorMessage.includes('sql')) {
    category = 'database';
  } else if (errorMessage.includes('auth') || errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
    category = 'security';
  } else if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('502') || errorMessage.includes('503')) {
    category = 'infrastructure';
  } else if (errorMessage.includes('cors')) {
    category = 'security';
  }

  return { severity, category };
}

/**
 * Generate unique incident ID
 */
function generateIncidentId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INC-${timestamp}-${random}`;
}

/**
 * Sanitize error message for storage
 */
function sanitizeErrorMessage(message) {
  if (!message) return 'Unknown error';

  // Truncate if too long
  if (message.length > 5000) {
    return message.substring(0, 5000) + '... [truncated]';
  }

  return message;
}

module.exports = {
  classifyError,
  generateIncidentId,
  sanitizeErrorMessage
};
