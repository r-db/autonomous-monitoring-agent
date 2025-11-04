const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for error creation
const errorCreationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // limit each IP to 50 error creations per 5 min
  message: 'Too many error reports, please slow down',
});

// Strict limiter for manual triggers
const triggerLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // limit manual triggers to 5 per minute
  message: 'Too many trigger requests, please wait',
});

module.exports = {
  apiLimiter,
  errorCreationLimiter,
  triggerLimiter
};
