const apiResponse = require('../utils/apiResponse');
const logger = require('../config/logger');
const fs = require('fs/promises');

function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  void next;
  if (req.file?.path) {
    fs.unlink(req.file.path).catch(() => undefined);
  }
  // Mongoose validation failures are caused by invalid request data, not an
  // unavailable server. Returning 400 lets the admin UI display the useful
  // validation message (for example an unsupported record status).
  const statusCode = error.statusCode || (error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500);
  const isProduction = process.env.NODE_ENV === 'production';
  logger.error('API action error', {
    requestId: req.requestId,
    message: error.message,
    stack: error.stack,
    path: req.originalUrl,
    method: req.method,
    userId: req.user?._id?.toString(),
    uploadAttempt: req.uploadAttempt,
    contentType: req.get('content-type'),
    contentLength: req.get('content-length'),
  });

  return apiResponse.error(res, {
    statusCode,
    message: error.message || 'Internal server error',
    errors: isProduction ? undefined : error.details || error.stack
  });
}

module.exports = { notFound, errorHandler };
