const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return next(new AppError('Insufficient permissions', STATUS_CODES.FORBIDDEN));
  }
  return next();
};

module.exports = { authorize };
