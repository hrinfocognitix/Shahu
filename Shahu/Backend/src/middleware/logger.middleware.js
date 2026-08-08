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
  files: req.file ? { field: req.file.fieldname, name: req.file.originalname, size: req.file.size } : undefined,
});

function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = String(requestId);
  res.setHeader('X-Request-Id', req.requestId);

  logger.info('API action started', {
    requestId: req.requestId,
    action: `${req.method} ${requestPath(req)}`,
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
      ...actionDetails(req),
    };
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger.log(level, res.statusCode >= 400 ? 'API action failed' : 'API action completed', meta);
  });
  next();
}

module.exports = requestLogger;
