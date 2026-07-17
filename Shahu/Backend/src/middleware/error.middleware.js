const apiResponse = require('../utils/apiResponse');
const logger = require('../config/logger');

function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  logger.error(error.message, { stack: error.stack, path: req.originalUrl });

  return apiResponse.error(res, {
    statusCode,
    message: error.message || 'Internal server error',
    errors: isProduction ? undefined : error.details || error.stack
  });
}

module.exports = { notFound, errorHandler };
