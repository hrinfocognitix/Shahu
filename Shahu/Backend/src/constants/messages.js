const MESSAGES = Object.freeze({
  HEALTH_OK: 'Service is healthy',
  LOGIN_SUCCESS: 'Logged in successfully',
  REGISTER_SUCCESS: 'Registered successfully',
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'Resource not found',
  VALIDATION_FAILED: 'Validation failed'
});

module.exports = { MESSAGES };
