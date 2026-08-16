const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const { STATUS_CODES } = require('../constants/statusCodes');
const { verifyAccessToken } = require('../helpers/jwt.helper');
const userRepository = require('../repositories/user.repository');
const Enrollment = require('../models/Enrollment');
const { ROLES } = require('../constants/roles');
const { mobileLoadControl } = require('./mobileLoadControl.middleware');

async function loadAuthenticatedUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    throw new AppError('Authentication required', STATUS_CODES.UNAUTHORIZED);
  }

  const decoded = verifyAccessToken(token);
  const user = await userRepository.findByIdForAuth(decoded.sub);
  if (!user || !user.isActive || Number(decoded.sv ?? -1) !== Number(user.authVersion || 0)) {
    throw new AppError('Invalid authentication token', STATUS_CODES.UNAUTHORIZED);
  }
  return user;
}

// Purchase endpoints must remain usable by a signed-in student whose previous
// course has expired. They still validate the signed-in student identity, but
// deliberately do not require an active enrollment.
const authenticateForPurchase = asyncHandler(async (req, res, next) => {
  req.user = await loadAuthenticatedUser(req);
  return next();
});

const authenticate = asyncHandler(async (req, res, next) => {
  const user = await loadAuthenticatedUser(req);
  req.user = user;
  if (user.role === ROLES.STUDENT) {
    const now = new Date();
    const activeEnrollment = await Enrollment.exists({
      student: user._id,
      status: 'active',
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    });
    if (!activeEnrollment) {
      throw new AppError('Your course plan has expired or is not active', STATUS_CODES.FORBIDDEN);
    }
  }
  const requestPath = String(req.originalUrl || '').split('?')[0].replace(/\/$/, '');
  // Keep this independent of the configured API version (for example /api/v1).
  // A user with a temporary password must always be able to replace it or log out.
  const passwordChangeAllowed =
    (req.method === 'PATCH' && /\/users\/me\/password$/.test(requestPath)) ||
    (req.method === 'POST' && /\/auth\/logout$/.test(requestPath)) ||
    (req.method === 'GET' && /\/users\/me$/.test(requestPath));
  if (user.mustChangePassword && !passwordChangeAllowed) {
    throw new AppError(
      'You must replace your temporary password before continuing',
      STATUS_CODES.FORBIDDEN
    );
  }
  return mobileLoadControl(req, res, next);
});

module.exports = { authenticate, authenticateForPurchase };
