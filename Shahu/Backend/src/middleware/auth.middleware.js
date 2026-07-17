const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const { STATUS_CODES } = require('../constants/statusCodes');
const { verifyAccessToken } = require('../helpers/jwt.helper');
const userRepository = require('../repositories/user.repository');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    throw new AppError('Authentication required', STATUS_CODES.UNAUTHORIZED);
  }

  const decoded = verifyAccessToken(token);
  const user = await userRepository.findById(decoded.sub);
  if (!user || !user.isActive) {
    throw new AppError('Invalid authentication token', STATUS_CODES.UNAUTHORIZED);
  }
  req.user = user;
  next();
});

module.exports = { authenticate };
