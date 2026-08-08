const crypto = require('crypto');
const logger = require('../config/logger');

const secretKey = /password|token|otp|secret|authorization|cookie|signature|refresh/i;
const personalKey = /email|mobile|phone|address|name|age|education|whatsapp|father|mother|guardian/i;

const requestPath = (req) => String(req.originalUrl || req.url || '').split('?')[0];

// Keep logs useful for diagnosis without writing credentials, OTPs, payment
// proof, or a whole student's profile to the production log stream.
const safeValue = (value, depth = 0) => {
  if (value == null || typeof value !== 'object') return value;
  if (depth >= 2) return Array.isArray(value) ? `[${value.length} items]` : '[object]';
  if (Array.isArray(value)) return value.map((item) => safeValue(item, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    secretKey.test(key) ? '[redacted]' : personalKey.test(key) ? '[present]' : safeValue(item, depth + 1),
  ]));
};

const actionDetails = (req) => ({
  body: Object.keys(req.body || {}).length ? safeValue(req.body) : undefined,
  query: Object.keys(req.query || {}).length ? safeValue(req.query) : undefined,
  params: Object.keys(req.params || {}).length ? safeValue(req.params) : undefined,
  files: req.file ? { field: req.file.fieldname, name: req.file.originalname, size: req.file.size } : undefined,
  uploadedFiles: Array.isArray(req.files)
    ? req.files.map((file) => ({ field: file.fieldname, name: file.originalname, size: file.size }))
    : undefined,
  uploadAttempt: req.uploadAttempt,
});

const isSubmission = (method) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

const responseSummary = (payload) => {
  if (!payload || typeof payload !== 'object') return undefined;
  return {
    success: typeof payload.success === 'boolean' ? payload.success : undefined,
    message: typeof payload.message === 'string' ? payload.message : undefined,
    code: typeof payload.code === 'string' ? payload.code : undefined,
  };
};

function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = String(requestId);
  res.setHeader('X-Request-Id', req.requestId);

  // Keep a small, safe summary of API responses so a Render log can show the
  // exact user-facing result without recording returned student data.
  let responseBody;
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    responseBody = responseSummary(payload);
    return originalJson(payload);
  };

  const eventName = isSubmission(req.method) ? 'API submission started' : 'API action started';

  logger.info(eventName, {
    requestId: req.requestId,
    action: `${req.method} ${requestPath(req)}`,
    submission: isSubmission(req.method),
    ipAddress: req.ip,
    ...actionDetails(req),
  });

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const meta = {
      requestId: req.requestId,
      action: `${req.method} ${requestPath(req)}`,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      ipAddress: req.ip,
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      userAgent: req.get('user-agent'),
      submission: isSubmission(req.method),
      response: responseBody,
      ...actionDetails(req),
    };
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger.log(
      level,
      res.statusCode >= 400
        ? (isSubmission(req.method) ? 'API submission failed' : 'API action failed')
        : (isSubmission(req.method) ? 'API submission successful' : 'API action completed'),
      meta
    );
  });
  next();
}

module.exports = requestLogger;
