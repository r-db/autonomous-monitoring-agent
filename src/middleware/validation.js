const { body, param, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Validation rules for error creation
const validateErrorCreation = [
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 1, max: 5000 }).withMessage('Message must be 1-5000 characters'),

  body('severity')
    .optional()
    .isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).withMessage('Invalid severity'),

  body('category')
    .optional()
    .isIn(['backend', 'frontend', 'database', 'security', 'infrastructure']).withMessage('Invalid category'),

  body('stack')
    .optional()
    .isString()
    .isLength({ max: 10000 }).withMessage('Stack trace too long'),

  body('metadata')
    .optional()
    .isObject().withMessage('Metadata must be an object'),

  validateRequest
];

// Validation for incident ID
const validateIncidentId = [
  param('id')
    .isUUID().withMessage('Invalid incident ID format'),
  validateRequest
];

module.exports = {
  validateErrorCreation,
  validateIncidentId,
  validateRequest
};
